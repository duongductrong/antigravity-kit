import { spawn } from "node:child_process";
import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import pc from "picocolors";
import { printHeader } from "../utils/branding.js";
import {
	type UpdateInfo,
	checkForUpdates,
	compareVersions,
	getPackageJson,
} from "../utils/version-checker.js";

interface UpgradeOption {
	value: "latest" | "beta" | "cancel";
	label: string;
	hint?: string;
}

/**
 * Execute npm install -g command to upgrade the package
 */
async function executeUpgrade(version: string): Promise<boolean> {
	return new Promise((resolve) => {
		const packageSpec = `antigravity-kit@${version}`;

		const child = spawn("npm", ["install", "-g", packageSpec], {
			stdio: "inherit",
			shell: true,
		});

		child.on("close", (code) => {
			resolve(code === 0);
		});

		child.on("error", () => {
			resolve(false);
		});
	});
}

/**
 * Build upgrade options based on available versions
 */
function buildUpgradeOptions(updateInfo: UpdateInfo): UpgradeOption[] {
	const options: UpgradeOption[] = [];

	if (updateInfo.hasLatestUpdate && updateInfo.latestVersion) {
		options.push({
			value: "latest",
			label: `Latest stable (${pc.green(updateInfo.latestVersion)})`,
			hint: "Recommended",
		});
	}

	if (updateInfo.hasBetaUpdate && updateInfo.betaVersion) {
		// Only show beta if it's newer than both current and latest
		const betaIsNewer =
			!updateInfo.latestVersion ||
			compareVersions(updateInfo.betaVersion, updateInfo.latestVersion) > 0;

		if (betaIsNewer) {
			options.push({
				value: "beta",
				label: `Beta (${pc.yellow(updateInfo.betaVersion)})`,
				hint: "May be unstable",
			});
		}
	}

	options.push({
		value: "cancel",
		label: "Cancel",
	});

	return options;
}

export default defineCommand({
	meta: {
		name: "upgrade",
		description: "Upgrade antigravity-kit to the latest version",
	},
	args: {
		beta: {
			type: "boolean",
			description: "Upgrade to the latest beta version",
			default: false,
		},
		latest: {
			type: "boolean",
			description: "Upgrade to the latest stable version",
			default: false,
		},
		check: {
			type: "boolean",
			description: "Check for updates without upgrading",
			default: false,
		},
	},
	async run({ args }) {
		printHeader("antigravity-kit upgrade");

		const pkg = getPackageJson();
		p.intro(`${pc.cyan("◆")} ${pc.bold("Upgrade Manager")}`);

		const spinner = p.spinner();
		spinner.start("Checking for updates...");

		const updateInfo = await checkForUpdates();

		if (!updateInfo) {
			spinner.stop("Check complete");
			console.log();
			p.note(
				`Unable to check for updates.\nThis may be due to network issues.`,
				"Error",
			);
			p.outro(pc.dim("Please try again later"));
			process.exit(1);
		}

		spinner.stop("Check complete");

		// Display current version info
		console.log();
		console.log(`  ${pc.dim("Current version:")} ${pc.cyan(pkg.version)}`);

		if (updateInfo.latestVersion) {
			const isLatest = compareVersions(pkg.version, updateInfo.latestVersion) >= 0;
			console.log(
				`  ${pc.dim("Latest stable:")}  ${isLatest ? pc.green(updateInfo.latestVersion) : pc.yellow(updateInfo.latestVersion)}`,
			);
		}

		if (updateInfo.betaVersion) {
			const isBeta = compareVersions(pkg.version, updateInfo.betaVersion) >= 0;
			console.log(
				`  ${pc.dim("Latest beta:")}    ${isBeta ? pc.green(updateInfo.betaVersion) : pc.yellow(updateInfo.betaVersion)}`,
			);
		}
		console.log();

		// Check-only mode
		if (args.check) {
			if (!updateInfo.hasLatestUpdate && !updateInfo.hasBetaUpdate) {
				p.outro(`${pc.green("✔")} You're on the latest version!`);
			} else {
				if (updateInfo.hasLatestUpdate) {
					console.log(
						`  ${pc.yellow("→")} Run ${pc.cyan("agk upgrade --latest")} to upgrade to stable`,
					);
				}
				if (updateInfo.hasBetaUpdate) {
					console.log(
						`  ${pc.yellow("→")} Run ${pc.cyan("agk upgrade --beta")} to upgrade to beta`,
					);
				}
				console.log();
				p.outro(pc.dim("Run without --check to upgrade"));
			}
			return;
		}

		// Already up to date
		if (!updateInfo.hasLatestUpdate && !updateInfo.hasBetaUpdate) {
			p.outro(`${pc.green("✔")} You're already on the latest version!`);
			return;
		}

		// Determine target version
		let targetVersion: string | null = null;
		let targetTag: "latest" | "beta" | null = null;

		if (args.beta) {
			if (!updateInfo.hasBetaUpdate || !updateInfo.betaVersion) {
				p.note("No beta version available or you're already on the latest beta.", "Info");
				p.outro(pc.dim("No upgrade needed"));
				return;
			}
			targetVersion = updateInfo.betaVersion;
			targetTag = "beta";
		} else if (args.latest) {
			if (!updateInfo.hasLatestUpdate || !updateInfo.latestVersion) {
				p.note("You're already on the latest stable version.", "Info");
				p.outro(pc.dim("No upgrade needed"));
				return;
			}
			targetVersion = updateInfo.latestVersion;
			targetTag = "latest";
		} else {
			// Interactive mode
			const options = buildUpgradeOptions(updateInfo);

			if (options.length === 1) {
				// Only cancel option, no upgrades available
				p.outro(`${pc.green("✔")} You're already on the latest version!`);
				return;
			}

			const selected = await p.select({
				message: "Select version to upgrade to:",
				options,
			});

			if (p.isCancel(selected) || selected === "cancel") {
				p.cancel("Upgrade cancelled");
				process.exit(0);
			}

			targetTag = selected as "latest" | "beta";
			targetVersion =
				targetTag === "latest"
					? updateInfo.latestVersion!
					: updateInfo.betaVersion!;
		}

		// Confirm upgrade
		const confirmed = await p.confirm({
			message: `Upgrade from ${pc.dim(pkg.version)} to ${pc.cyan(targetVersion)}?`,
			initialValue: true,
		});

		if (p.isCancel(confirmed) || !confirmed) {
			p.cancel("Upgrade cancelled");
			process.exit(0);
		}

		// Execute upgrade
		console.log();
		const upgradeSpinner = p.spinner();
		upgradeSpinner.start(`Upgrading to ${targetVersion}...`);

		const success = await executeUpgrade(targetTag);

		if (success) {
			upgradeSpinner.stop("Upgrade complete");
			console.log();
			p.outro(
				`${pc.green("✔")} Successfully upgraded to ${pc.cyan(targetVersion)}`,
			);
		} else {
			upgradeSpinner.stop("Upgrade failed");
			console.log();
			p.note(
				`Failed to upgrade automatically.\n\nTry running manually:\n  ${pc.cyan(`npm install -g antigravity-kit@${targetTag}`)}`,
				"Error",
			);
			p.outro(pc.dim("Upgrade failed"));
			process.exit(1);
		}
	},
});
