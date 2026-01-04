import * as p from "@clack/prompts";
import { defineCommand } from "citty";
import pc from "picocolors";
import Table from "cli-table3";
import { printHeader } from "../../utils/branding.js";
import {
	formatSize,
	getProfileSize,
	listProfiles,
} from "../../utils/profile-manager.js";
import { isActiveProfile } from "../../utils/symlink-manager.js";
import { hasStoredToken, isTokenInKeychain, getRefreshToken } from "../../utils/token-storage.js";
import { getQuotaWithRefresh, type ModelQuota } from "../../utils/quota.js";

// ============================================
// CONFIGURATION
// ============================================

const TARGET_MODEL_CLAUDE = "claude-opus-4-5-thinking";
const TARGET_MODEL_GEMINI = "gemini-3-pro-high";
const REFRESH_INTERVAL = 30; // seconds

// ============================================
// TYPES
// ============================================

interface QuotaInfo {
	percentage: number;
	resetTime: string;
}

interface ProfileWithQuota {
	email: string;
	profilePath: string;
	createdAt: number;
	isActive: boolean;
	hasOAuth: boolean;
	isKeychain: boolean;
	size: number;
	quotas: Map<string, QuotaInfo | null>; // model name -> quota info or null
	isLoading: boolean;
	error?: string;
}

// ============================================
// UI HELPERS
// ============================================

function formatDate(timestamp: number): string {
	const date = new Date(timestamp);
	return date.toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function truncate(str: string, maxLength: number): string {
	if (str.length <= maxLength) return str;
	return `${str.slice(0, maxLength - 3)}...`;
}

function clearLines(count: number): void {
	for (let i = 0; i < count; i++) {
		process.stdout.write("\x1b[1A\x1b[2K");
	}
}

function formatResetTime(resetTimeStr: string): string {
	if (!resetTimeStr) return "";

	try {
		const resetTime = new Date(resetTimeStr);
		const now = new Date();
		const diffMs = resetTime.getTime() - now.getTime();

		if (diffMs <= 0) return "now";

		const hours = Math.floor(diffMs / (1000 * 60 * 60));
		const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

		if (hours > 0) {
			return `${hours}h${minutes}m`;
		}
		return `${minutes}m`;
	} catch {
		return "";
	}
}

function createQuotaDisplay(info: QuotaInfo | null, isLoading: boolean): string {
	if (isLoading) return pc.dim("...");
	if (info === null) return pc.dim("—");

	const percentage = info.percentage;
	const resetStr = formatResetTime(info.resetTime);

	// Color based on percentage
	let color: (s: string) => string;
	if (percentage >= 70) {
		color = pc.green;
	} else if (percentage >= 30) {
		color = pc.yellow;
	} else {
		color = pc.red;
	}

	// Format: "52% (1h30m)" or "52%" if no reset time
	const pctStr = `${percentage}%`;
	const display = resetStr ? `${pctStr} (${resetStr})` : pctStr;
	return color(display);
}

function getStorageBadge(email: string): string {
	if (!isTokenInKeychain(email)) {
		return pc.dim("—");
	}
	return "🔐";
}

function findModelQuota(models: ModelQuota[], targetModel: string): QuotaInfo | null {
	// Find exact match or partial match
	const model = models.find(m =>
		m.name === targetModel ||
		m.name.includes(targetModel) ||
		targetModel.includes(m.name.split("/").pop() || "")
	);
	if (!model) return null;
	return {
		percentage: model.percentage,
		resetTime: model.resetTime,
	};
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
// RENDERING
// ============================================

function renderTable(
	profiles: ProfileWithQuota[],
	countdown: number,
	isLoading: boolean
): number {
	const lines: string[] = [];

	// Create beautiful table using cli-table3
	const table = new Table({
		head: [
			pc.white(""),
			pc.white("Email"),
			pc.white("OAuth"),
			pc.white("Storage"),
			pc.white("Claude"),
			pc.white("Gemini"),
			pc.white("Size"),
			pc.white("Created"),
		],
		style: {
			head: [],
			border: ["gray"],
		},
		chars: {
			"top": "─",
			"top-mid": "┬",
			"top-left": "┌",
			"top-right": "┐",
			"bottom": "─",
			"bottom-mid": "┴",
			"bottom-left": "└",
			"bottom-right": "┘",
			"left": "│",
			"left-mid": "├",
			"mid": "─",
			"mid-mid": "┼",
			"right": "│",
			"right-mid": "┤",
			"middle": "│",
		},
		colWidths: [3, 30, 7, 9, 16, 16, 12, 14],
	});

	for (const profile of profiles) {
		const indicator = profile.isActive ? pc.green("●") : pc.dim("○");
		const emailDisplay = truncate(profile.email, 28);
		const email = profile.isActive ? pc.green(emailDisplay) : emailDisplay;

		const oauth = profile.hasOAuth ? pc.green("✓") : pc.dim("✗");
		const storage = getStorageBadge(profile.email);

		// Get quota values for target models
		const claudeQuota = profile.quotas.get(TARGET_MODEL_CLAUDE) ?? null;
		const geminiQuota = profile.quotas.get(TARGET_MODEL_GEMINI) ?? null;

		table.push([
			indicator,
			email,
			oauth,
			storage,
			createQuotaDisplay(claudeQuota, profile.isLoading),
			createQuotaDisplay(geminiQuota, profile.isLoading),
			formatSize(profile.size),
			pc.dim(formatDate(profile.createdAt)),
		]);
	}

	lines.push("");
	lines.push(pc.bold("  📊 Account Profiles"));
	lines.push("");

	// Split table into lines
	const tableString = table.toString();
	const tableLines = tableString.split("\n");
	for (const line of tableLines) {
		lines.push(`  ${line}`);
	}

	lines.push("");

	// Active profile info
	const activeProfile = profiles.find(p => p.isActive);
	if (activeProfile) {
		lines.push(pc.dim("  Active: ") + pc.green(activeProfile.email));
	}

	// Legend
	lines.push("");
	lines.push(
		pc.dim("  Legend: ") +
		pc.green("●") + pc.dim(" Active  ") +
		pc.green("✓") + pc.dim(" OAuth  ") +
		"🔐" + pc.dim(" Keychain  ") +
		pc.green("N%") + pc.dim(" Quota (reset)")
	);

	lines.push(
		pc.dim(
			`  Total: ${profiles.length} profile${profiles.length === 1 ? "" : "s"}`,
		),
	);

	// Footer with controls
	lines.push("");
	if (isLoading) {
		lines.push(pc.dim("  ⟳ Loading quotas..."));
	} else {
		lines.push(pc.dim(`  ⟳ Auto-refresh in ${countdown}s | Press 'r' to reload | Press 'q' to exit`));
	}
	lines.push("");

	for (const line of lines) {
		console.log(line);
	}

	return lines.length;
}

// ============================================
// QUOTA FETCHING
// ============================================

async function fetchQuotasForProfiles(profiles: ProfileWithQuota[]): Promise<void> {
	const fetchPromises = profiles.map(async (profile) => {
		if (!profile.hasOAuth) {
			return;
		}

		try {
			const refreshToken = await getRefreshToken(profile.email);
			if (!refreshToken) {
				return;
			}

			const result = await getQuotaWithRefresh(refreshToken);

			// Extract quotas for target models
			const targetModels = [TARGET_MODEL_CLAUDE, TARGET_MODEL_GEMINI];
			for (const targetModel of targetModels) {
				const quota = findModelQuota(result.models, targetModel);
				profile.quotas.set(targetModel, quota);
			}
		} catch (error) {
			profile.error = error instanceof Error ? error.message : "Unknown error";
		}
	});

	await Promise.all(fetchPromises);
}

// ============================================
// MAIN COMMAND
// ============================================

export default defineCommand({
	meta: {
		name: "list",
		description: "List all saved Google AntiGravity profiles with quota information",
	},
	async run() {
		printHeader("antigravity-kit auth list");

		p.intro(pc.cyan("◆") + " " + pc.bold("Saved Profiles"));

		const rawProfiles = listProfiles();

		if (rawProfiles.length === 0) {
			p.note(
				`No profiles found. Add one with:

  ${pc.cyan("antigravity-kit auth add")}`,
				"Empty",
			);
			p.outro(pc.dim("No profiles to display"));
			return;
		}

		// Build profile data with quota placeholders
		const profiles: ProfileWithQuota[] = await Promise.all(
			rawProfiles.map(async (profile) => ({
				email: profile.email,
				profilePath: profile.profilePath,
				createdAt: profile.createdAt,
				isActive: isActiveProfile(profile.profilePath),
				hasOAuth: await hasStoredToken(profile.email),
				isKeychain: isTokenInKeychain(profile.email),
				size: getProfileSize(profile.profilePath),
				quotas: new Map<string, QuotaInfo | null>(),
				isLoading: true,
			}))
		);

		let running = true;
		let lastLineCount = 0;
		let countdown = REFRESH_INTERVAL;
		let isLoadingQuotas = false;

		// Render function - just renders current state
		const render = (showLoadingIndicator: boolean) => {
			if (lastLineCount > 0) {
				clearLines(lastLineCount);
			}
			lastLineCount = renderTable(profiles, countdown, showLoadingIndicator);
		};

		// Fetch and update function - fetches then re-renders
		const fetchAndRender = async () => {
			if (isLoadingQuotas) return; // Prevent concurrent fetches

			isLoadingQuotas = true;

			// Mark all profiles as loading
			for (const profile of profiles) {
				profile.isLoading = true;
			}

			// Render loading state
			render(true);

			// Fetch quotas
			await fetchQuotasForProfiles(profiles);

			// Mark all profiles as done loading
			for (const profile of profiles) {
				profile.isLoading = false;
			}

			countdown = REFRESH_INTERVAL;
			isLoadingQuotas = false;

			// Render final state
			render(false);
		};

		// Initial render with loading state, then fetch
		console.log();
		lastLineCount = renderTable(profiles, countdown, true);

		// Fetch quotas (will clear and re-render when done)
		await fetchQuotasForProfiles(profiles);

		// Mark all profiles as done loading
		for (const profile of profiles) {
			profile.isLoading = false;
		}

		// Render with actual data
		render(false);

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

			// Update countdown display (only if not loading)
			if (!isLoadingQuotas) {
				render(false);
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
					p.outro(pc.dim("Profile list closed"));
					resolve();
				}
			}, 100);
		});
	},
});
