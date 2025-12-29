import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import pc from "picocolors";
import { openAntigravity } from "../../utils/antigravity-launcher.js";
import { printHeader } from "../../utils/branding.js";
import {
	addProfileAndSetActive,
	copyDefaultProfileToStorage,
	getDefaultAntigravityDataDir,
	getDefaultStateDbPath,
	getProfileByEmail,
	watchForAuth,
} from "../../utils/profile-manager.js";
import { getFirstAuthSession } from "../../utils/sqlite-reader.js";
import type { AuthSessionData } from "../../types/auth.js";

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

export default defineCommand({
	meta: {
		name: "add",
		description: "Add a new Google AntiGravity account",
	},
	async run() {
		printHeader("antigravity-kit auth add");

		p.intro(pc.cyan("◆") + " " + pc.bold("Add a new account"));

		p.note(
			`This will open Antigravity for you to sign in.

${pc.cyan("Steps:")}
1. Antigravity will open
2. Sign in with your Google account
3. The CLI will automatically detect when you've logged in

${pc.yellow("⚠")} ${pc.dim("If you're already logged in, sign out first in Antigravity.")}`,
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

		const spinner = p.spinner();

		try {
			console.log();
			p.note(
				`${pc.dim("Opening Antigravity...")}
${pc.dim("Please sign in with your Google account.")}

${pc.yellow("⚠")} ${pc.dim("Do not close Antigravity until the login is complete.")}`,
				"Action Required",
			);

			spinner.start("Opening Antigravity...");

			// Open Antigravity using default data directory
			const defaultDataDir = getDefaultAntigravityDataDir();
			await openAntigravity(defaultDataDir);

			spinner.stop("Antigravity opened");

			spinner.start(
				"Waiting for login... " + pc.dim("(Press Enter to check manually)"),
			);

			const dbPath = getDefaultStateDbPath();

			let session: AuthSessionData | undefined;
			let loginDetected = false;

			while (!loginDetected) {
				const watchPromise = watchForAuth(300000).then(
					(res): WaitResult => ({ type: "auto", session: res.session }),
				);
				// Prevent unhandled rejection if watchPromise times out after we move on
				watchPromise.catch(() => {});

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
							pc.yellow("No login detected. Please sign in with your Google account in Antigravity."),
						);
						console.log();
						spinner.start(
							"Waiting for login... " + pc.dim("(Press Enter to check manually)"),
						);
					}
				}
			}

			spinner.stop("Login detected!");

			console.log();
			console.log(
				pc.dim("Detected account: ") + pc.green(session.email),
			);
			if (session.name) {
				console.log(pc.dim("Name: ") + pc.cyan(session.name));
			}
			console.log();

			const existingProfile = getProfileByEmail(session.email);
			if (existingProfile) {
				const shouldReplace = await p.confirm({
					message: `Profile for ${pc.cyan(session.email)} already exists. Replace it?`,
					initialValue: true,
				});

				if (p.isCancel(shouldReplace) || !shouldReplace) {
					p.cancel("Operation cancelled");
					process.exit(0);
				}
			}

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
	},
});
