import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import pc from "picocolors";
import { printHeader } from "../../utils/branding.js";
import { listProfiles } from "../../utils/profile-manager.js";
import { isActiveProfile } from "../../utils/symlink-manager.js";
import { getRefreshToken, hasStoredToken } from "../../utils/token-storage.js";
import { getQuotaWithRefresh, type QuotaResult } from "../../utils/quota.js";

// ============================================
// UI HELPERS
// ============================================

function clearLines(count: number): void {
	for (let i = 0; i < count; i++) {
		process.stdout.write("\x1b[1A\x1b[2K");
	}
}

function formatResetTime(resetTimeStr: string): string {
	if (!resetTimeStr) return "—";

	try {
		const resetTime = new Date(resetTimeStr);
		const now = new Date();
		const diffMs = resetTime.getTime() - now.getTime();

		if (diffMs <= 0) return "now";

		const hours = Math.floor(diffMs / (1000 * 60 * 60));
		const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

		if (hours > 0) {
			return `in ${hours}h ${minutes}m`;
		}
		return `in ${minutes}m`;
	} catch {
		return resetTimeStr.slice(0, 16);
	}
}

function createProgressBar(percentage: number, width = 10): string {
	const filled = Math.round((percentage / 100) * width);
	const empty = width - filled;

	// Color based on percentage
	let color: (s: string) => string;
	if (percentage >= 70) {
		color = pc.green;
	} else if (percentage >= 30) {
		color = pc.yellow;
	} else {
		color = pc.red;
	}

	return color("█".repeat(filled)) + pc.dim("░".repeat(empty));
}

function renderQuotaTable(
	email: string,
	quota: QuotaResult,
	countdown: number,
	isLoading = false
): number {
	const lines: string[] = [];

	// Header
	lines.push("");
	lines.push(pc.bold(`  📊 Quota Status - ${pc.cyan(email)}`));

	if (quota.subscriptionTier) {
		lines.push(`  💎 Subscription: ${pc.magenta(quota.subscriptionTier)}`);
	}

	if (quota.isForbidden) {
		lines.push(`  ${pc.red("🚫 Status: FORBIDDEN (403)")}`);
		lines.push("");
		return printLines(lines);
	}

	lines.push("");

	// Table header
	const modelColWidth = 28;
	const quotaColWidth = 14;
	const resetColWidth = 15;

	lines.push(
		pc.dim("  ┌" + "─".repeat(modelColWidth) + "┬" + "─".repeat(quotaColWidth) + "┬" + "─".repeat(resetColWidth) + "┐")
	);
	lines.push(
		`  │${pc.bold(" Model".padEnd(modelColWidth - 1))}│${pc.bold(" Quota".padEnd(quotaColWidth - 1))}│${pc.bold(" Reset Time".padEnd(resetColWidth - 1))}│`
	);
	lines.push(
		pc.dim("  ├" + "─".repeat(modelColWidth) + "┼" + "─".repeat(quotaColWidth) + "┼" + "─".repeat(resetColWidth) + "┤")
	);

	// Sort models by name
	const sortedModels = [...quota.models].sort((a, b) => a.name.localeCompare(b.name));

	for (const model of sortedModels) {
		const displayName = model.name.length > modelColWidth - 3
			? model.name.slice(0, modelColWidth - 4) + "…"
			: model.name;
		const bar = createProgressBar(model.percentage);
		const pct = `${model.percentage}%`.padStart(4);
		const reset = formatResetTime(model.resetTime);

		lines.push(
			`  │ ${displayName.padEnd(modelColWidth - 2)}│ ${bar} ${pct} │ ${reset.padEnd(resetColWidth - 3)}│`
		);
	}

	lines.push(
		pc.dim("  └" + "─".repeat(modelColWidth) + "┴" + "─".repeat(quotaColWidth) + "┴" + "─".repeat(resetColWidth) + "┘")
	);

	// Footer
	lines.push("");

	if (isLoading) {
		lines.push(pc.dim(`  ⟳ Loading...`));
	} else {
		lines.push(pc.dim(`  ⟳ Auto-refresh in ${countdown}s | Press 'r' to reload | Press 'q' to exit`));
	}

	lines.push("");

	return printLines(lines);
}

function printLines(lines: string[]): number {
	for (const line of lines) {
		console.log(line);
	}
	return lines.length;
}

// ============================================
// KEY INPUT HANDLING
// ============================================

function setupKeyHandler(
	onReload: () => void,
	onExit: () => void
): () => void {
	const stdin = process.stdin;

	if (stdin.isTTY) {
		stdin.setRawMode(true);
	}
	stdin.resume();
	stdin.setEncoding("utf8");

	const handler = (key: string) => {
		if (key === "q" || key === "\x03") {
			// 'q' or Ctrl+C
			onExit();
		} else if (key === "r") {
			onReload();
		}
	};

	stdin.on("data", handler);

	return () => {
		stdin.removeListener("data", handler);
		if (stdin.isTTY) {
			stdin.setRawMode(false);
		}
		stdin.pause();
	};
}

// ============================================
// MAIN COMMAND
// ============================================

export default defineCommand({
	meta: {
		name: "quota",
		description: "Check quota for Google AntiGravity accounts",
	},
	args: {
		account: {
			type: "string",
			description: "Email of the account to check (defaults to active profile)",
			alias: "a",
		},
		interval: {
			type: "string",
			description: "Auto-refresh interval in seconds (default: 30)",
			alias: "i",
			default: "30",
		},
	},
	async run({ args }) {
		printHeader("antigravity-kit auth quota");

		p.intro(`${pc.cyan("◆")} ${pc.bold("Quota Monitor")}`);

		// Find the account to check
		let email: string | undefined;

		if (args.account) {
			email = args.account;
		} else {
			// Find active profile
			const profiles = listProfiles();
			const activeProfile = profiles.find((profile) => isActiveProfile(profile.profilePath));

			if (activeProfile) {
				email = activeProfile.email;
			}
		}

		if (!email) {
			p.note(
				`No active profile found. Add an account first:

  ${pc.cyan("antigravity-kit auth add")}`,
				"No Account",
			);
			p.cancel("No account to check quota for");
			process.exit(1);
		}

		// Check if we have a refresh token for this account
		if (!hasStoredToken(email)) {
			p.note(
				`No OAuth token found for ${pc.cyan(email)}.

To enable quota checking, re-add this account using OAuth:

  ${pc.cyan("antigravity-kit auth add")}

${pc.dim("(The account was likely added using --manual mode)")}`,
				"Token Required",
			);
			p.cancel("Cannot check quota without OAuth token");
			process.exit(1);
		}

		const refreshToken = getRefreshToken(email);
		if (!refreshToken) {
			p.cancel("Failed to retrieve refresh token");
			process.exit(1);
		}

		const refreshInterval = Math.max(10, Number.parseInt(args.interval, 10) || 30);

		console.log();
		console.log(pc.dim(`  Monitoring quota for ${pc.cyan(email)}`));
		console.log(pc.dim(`  Refresh interval: ${refreshInterval}s`));

		let running = true;
		let lastLineCount = 0;
		let countdown = refreshInterval;
		let isLoading = true;
		let currentQuota: QuotaResult | null = null;

		const fetchAndRender = async () => {
			isLoading = true;

			// Clear previous output
			if (lastLineCount > 0) {
				clearLines(lastLineCount);
			}

			// Show loading state
			if (currentQuota) {
				lastLineCount = renderQuotaTable(email!, currentQuota, countdown, true);
			}

			try {
				const result = await getQuotaWithRefresh(refreshToken);
				currentQuota = result;
				countdown = refreshInterval;
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : "Unknown error";
				console.log(pc.red(`  ❌ Failed to fetch quota: ${errorMsg}`));
			}

			isLoading = false;

			// Clear and re-render
			if (lastLineCount > 0) {
				clearLines(lastLineCount);
			}

			if (currentQuota) {
				lastLineCount = renderQuotaTable(email!, currentQuota, countdown, false);
			}
		};

		// Initial fetch
		await fetchAndRender();

		// Setup key handler
		const cleanup = setupKeyHandler(
			() => {
				// Manual reload
				fetchAndRender();
			},
			() => {
				// Exit
				running = false;
			}
		);

		// Auto-refresh loop
		const intervalId = setInterval(() => {
			if (!running) {
				clearInterval(intervalId);
				cleanup();
				process.exit(0);
			}

			countdown--;

			// Update countdown display
			if (lastLineCount > 0 && currentQuota && !isLoading) {
				clearLines(lastLineCount);
				lastLineCount = renderQuotaTable(email!, currentQuota, countdown, false);
			}

			if (countdown <= 0) {
				fetchAndRender();
			}
		}, 1000);

		// Keep process alive
		await new Promise<void>((resolve) => {
			const checkInterval = setInterval(() => {
				if (!running) {
					clearInterval(checkInterval);
					clearInterval(intervalId);
					cleanup();
					console.log();
					p.outro(pc.dim("Quota monitor stopped"));
					resolve();
				}
			}, 100);
		});
	},
});
