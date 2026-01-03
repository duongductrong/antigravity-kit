import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import pc from "picocolors";
import type { AuthSessionData } from "../../types/auth.js";
import { openAntigravity } from "../../utils/antigravity-launcher.js";
import { printHeader } from "../../utils/branding.js";
import { startOAuthFlow } from "../../utils/oauth-server.js";
import { saveRefreshToken, isKeychainAvailable } from "../../utils/token-storage.js";
import {
	addProfileAndSetActive,
	copyDefaultProfileToStorage,
	getDefaultAntigravityDataDir,
	getDefaultStateDbPath,
	getProfileByEmail,
	watchForAuth,
} from "../../utils/profile-manager.js";
import { getFirstAuthSession } from "../../utils/sqlite-reader.js";

type WaitResultType = "auto" | "manual";

interface WaitResult {
	type: WaitResultType;
	session?: AuthSessionData;
}

function waitForEnterKey(): Promise<void> {
	return new Promise((resolve) => {
		const onData = (data: Buffer) => {
			if (data.toString().includes("\n") || data.toString().includes("\r")) {
				process.stdin.removeListener("data", onData);
				if (process.stdin.isTTY) {
					process.stdin.setRawMode(false);
				}
				resolve();
			}
		};
		if (process.stdin.isTTY) {
			process.stdin.setRawMode(true);
		}
		process.stdin.resume();
		process.stdin.on("data", onData);
	});
}

function cleanupStdin(): void {
	if (process.stdin.isTTY) {
		process.stdin.setRawMode(false);
	}
	process.stdin.pause();
	process.stdin.removeAllListeners("data");
}

async function waitForIdeLogin(): Promise<AuthSessionData> {
	const spinner = p.spinner();

	console.log();
	p.note(
		`${pc.dim("Opening Antigravity...")}
${pc.dim("Please sign in with your Google account.")}

${pc.yellow("⚠")} ${pc.dim("Do not close Antigravity until the login is complete.")}`,
		"Action Required",
	);

	spinner.start("Opening Antigravity...");

	const defaultDataDir = getDefaultAntigravityDataDir();
	await openAntigravity(defaultDataDir);

	spinner.stop("Antigravity opened");

	spinner.start(
		`Waiting for login... ${pc.dim("(Press Enter to check manually)")}`,
	);

	const dbPath = getDefaultStateDbPath();

	let session: AuthSessionData | undefined;
	let loginDetected = false;

	while (!loginDetected) {
		const watchPromise = watchForAuth(300000).then(
			(res): WaitResult => ({ type: "auto", session: res.session }),
		);
		watchPromise.catch(() => { });

		const result = await Promise.race<WaitResult>([
			watchPromise,
			waitForEnterKey().then((): WaitResult => ({ type: "manual" })),
		]);

		if (result.type === "auto" && result.session) {
			session = result.session;
			loginDetected = true;
			cleanupStdin();
		} else if (result.type === "manual") {
			spinner.stop("Checking login status...");

			const currentSession = getFirstAuthSession(dbPath);

			if (currentSession) {
				session = currentSession;
				loginDetected = true;
			} else {
				console.log();
				p.log.warning(
					pc.yellow(
						"No login detected. Please sign in with your Google account in Antigravity.",
					),
				);
				console.log();
				spinner.start(
					`Waiting for login... ${pc.dim("(Press Enter to check manually)")}`,
				);
			}
		}
	}

	spinner.stop("Login detected!");

	if (!session) {
		throw new Error("No session detected after login");
	}

	return session;
}

export default defineCommand({
	meta: {
		name: "add",
		description: "Add a new Google AntiGravity account",
	},
	args: {
		manual: {
			type: "boolean",
			description: "Use manual IDE login instead of OAuth",
			default: false,
		},
		insecure: {
			type: "boolean",
			description: "Store tokens in local file instead of Keychain",
			default: false,
		},
	},
	async run({ args }) {
		printHeader("antigravity-kit auth add");

		p.intro(`${pc.cyan("◆")} ${pc.bold("Add a new account")}`);

		const spinner = p.spinner();

		// Use OAuth flow by default, manual flow with --manual flag
		if (args.manual) {
			// Manual flow: open Antigravity IDE and watch for login
			await runManualFlow(spinner);
		} else {
			// OAuth flow: open browser for Google sign-in
			await runOAuthFlow(spinner, args.insecure);
		}
	},
});

async function runOAuthFlow(spinner: ReturnType<typeof p.spinner>, insecure: boolean): Promise<void> {
	console.log();
	p.note(
		`${pc.cyan("This will:")}
1. Open your browser for Google sign-in
2. Capture your login and create a profile
3. Store tokens for quota checking

${(await isKeychainAvailable()) && !insecure ? pc.green("🔐 Tokens will be stored in macOS Keychain") : pc.dim("💾 Tokens will be stored locally")}`,
		"OAuth Sign-in",
	);

	const shouldContinue = await p.confirm({
		message: "Ready to continue?",
		initialValue: true,
	});

	if (p.isCancel(shouldContinue) || !shouldContinue) {
		p.cancel("Operation cancelled");
		process.exit(0);
	}

	try {
		const result = await startOAuthFlow();
		const email = result.userInfo.email;

		// Check if profile already exists
		const existingProfile = getProfileByEmail(email);
		if (existingProfile) {
			console.log();
			console.log(pc.dim("Account already exists: ") + pc.green(email));

			const shouldReplace = await p.confirm({
				message: "Replace the existing profile with fresh data?",
				initialValue: false,
			});

			if (p.isCancel(shouldReplace) || !shouldReplace) {
				p.cancel("Operation cancelled");
				process.exit(0);
			}
		}

		console.log();
		console.log(pc.dim("Account to add: ") + pc.green(email));
		if (result.userInfo.name) {
			console.log(pc.dim("Name: ") + pc.cyan(result.userInfo.name));
		}
		console.log();

		spinner.start("Saving profile...");

		// Copy current IDE settings/profile to preserve extensions, themes, etc.
		const profilePath = copyDefaultProfileToStorage(email);
		const profile = addProfileAndSetActive(email, profilePath);

		// Save refresh token (Keychain by default on macOS unless --insecure)
		await saveRefreshToken(email, result.tokens.refresh_token, insecure);

		spinner.stop("Profile saved");

		console.log();
		p.note(
			`${pc.green("Email:")} ${profile.email}
${pc.green("Profile:")} ${profilePath}
${pc.green("Status:")} ${pc.cyan("Active")}
${pc.green("Quota:")} ${result.quota.models.length} models available`,
			"Profile Created",
		);

		p.outro(
			`${pc.green("✔")} Account ${pc.cyan(email)} added successfully!`,
		);
	} catch (error) {
		spinner.stop("Failed");

		const errorMessage =
			error instanceof Error ? error.message : "Unknown error occurred";
		p.cancel(`Failed to add account: ${errorMessage}`);
		process.exit(1);
	}
}

async function runManualFlow(spinner: ReturnType<typeof p.spinner>): Promise<void> {
	const dbPath = getDefaultStateDbPath();

	// Check if there's existing auth in the default Antigravity data directory
	let session = getFirstAuthSession(dbPath);

	if (session) {
		// Found existing auth - ask if user wants to use it or login fresh
		console.log();
		console.log(
			pc.dim("Found existing login: ") + pc.green(session.email),
		);
		if (session.name) {
			console.log(pc.dim("Name: ") + pc.cyan(session.name));
		}
		console.log();

		const existingProfile = getProfileByEmail(session.email);

		if (existingProfile) {
			// Profile already exists for this account
			p.note(
				`A profile for ${pc.cyan(session.email)} already exists.

${pc.cyan("To add a different account:")}
1. Open Antigravity IDE
2. Sign out from your current account
3. Sign in with the new account
4. Run this command again`,
				"Account Already Added",
			);

			const shouldReplace = await p.confirm({
				message: "Replace the existing profile with fresh data?",
				initialValue: false,
			});

			if (p.isCancel(shouldReplace) || !shouldReplace) {
				p.cancel("Operation cancelled");
				process.exit(0);
			}
		} else {
			// New account detected - ask to add it
			const shouldAdd = await p.confirm({
				message: `Add ${pc.cyan(session.email)} as a new profile?`,
				initialValue: true,
			});

			if (p.isCancel(shouldAdd)) {
				p.cancel("Operation cancelled");
				process.exit(0);
			}

			if (!shouldAdd) {
				// User wants to login with different account
				p.note(
					`${pc.cyan("To add a different account:")}
1. Open Antigravity IDE
2. Sign out from your current account  
3. Sign in with the new account
4. Run this command again`,
					"Add Different Account",
				);
				p.cancel("Operation cancelled");
				process.exit(0);
			}
		}
	} else {
		// No existing auth - need to login via IDE
		p.note(
			`No existing Antigravity login found.

${pc.cyan("This will:")}
1. Open Antigravity IDE
2. You sign in with your Google account
3. CLI will capture your login and create a profile

${pc.yellow("⚠")} ${pc.dim("Antigravity IDE must be installed.")}`,
			"How it works",
		);

		const shouldContinue = await p.confirm({
			message: "Ready to continue?",
			initialValue: true,
		});

		if (p.isCancel(shouldContinue) || !shouldContinue) {
			p.cancel("Operation cancelled");
			process.exit(0);
		}

		session = await waitForIdeLogin();
	}

	try {
		console.log();
		console.log(pc.dim("Account to add: ") + pc.green(session.email));
		if (session.name) {
			console.log(pc.dim("Name: ") + pc.cyan(session.name));
		}
		console.log();

		spinner.start("Saving profile...");

		// Copy the current default Antigravity data to our profiles storage
		const profilePath = copyDefaultProfileToStorage(session.email);
		const profile = addProfileAndSetActive(session.email, profilePath);

		spinner.stop("Profile saved");

		console.log();
		p.note(
			`${pc.green("Email:")} ${profile.email}
${pc.green("Profile:")} ${profilePath}
${pc.green("Status:")} ${pc.cyan("Active")}`,
			"Profile Created",
		);

		p.outro(
			`${pc.green("✔")} Account ${pc.cyan(session.email)} added successfully!`,
		);
	} catch (error) {
		spinner.stop("Failed");

		const errorMessage =
			error instanceof Error ? error.message : "Unknown error occurred";
		p.cancel(`Failed to add account: ${errorMessage}`);
		process.exit(1);
	}
}
