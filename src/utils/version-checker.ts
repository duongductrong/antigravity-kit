import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pc from "picocolors";

const __dirname = dirname(fileURLToPath(import.meta.url));

const NPM_REGISTRY_URL = "https://registry.npmjs.org/antigravity-kit";

interface PackageJson {
	version: string;
	name: string;
}

interface NpmDistTags {
	latest?: string;
	beta?: string;
	[key: string]: string | undefined;
}

interface NpmPackageInfo {
	"dist-tags"?: NpmDistTags;
}

export interface UpdateInfo {
	currentVersion: string;
	latestVersion?: string;
	betaVersion?: string;
	hasLatestUpdate: boolean;
	hasBetaUpdate: boolean;
}

/**
 * Get the current package version from package.json
 */
export function getPackageJson(): PackageJson {
	try {
		// When bundled by tsup, all output is flat in dist/
		// So we only need to go up one level to find package.json
		const pkgPath = join(__dirname, "..", "package.json");
		const content = readFileSync(pkgPath, "utf-8");
		return JSON.parse(content) as PackageJson;
	} catch {
		return { version: "0.0.0", name: "antigravity-kit" };
	}
}

/**
 * Parse a semantic version string into components
 */
function parseVersion(version: string): {
	major: number;
	minor: number;
	patch: number;
	prerelease: string | null;
} {
	const cleanVersion = version.replace(/^v/, "");
	const [mainPart = "0.0.0", prerelease] = cleanVersion.split("-");
	const [major, minor, patch] = mainPart.split(".").map(Number);
	return {
		major: major || 0,
		minor: minor || 0,
		patch: patch || 0,
		prerelease: prerelease || null,
	};
}

/**
 * Compare two semantic versions
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareVersions(v1: string, v2: string): number {
	const parsed1 = parseVersion(v1);
	const parsed2 = parseVersion(v2);

	// Compare major.minor.patch
	if (parsed1.major !== parsed2.major) {
		return parsed1.major > parsed2.major ? 1 : -1;
	}
	if (parsed1.minor !== parsed2.minor) {
		return parsed1.minor > parsed2.minor ? 1 : -1;
	}
	if (parsed1.patch !== parsed2.patch) {
		return parsed1.patch > parsed2.patch ? 1 : -1;
	}

	// Handle prerelease comparison
	// No prerelease > prerelease (e.g., 1.0.0 > 1.0.0-beta.1)
	if (!parsed1.prerelease && parsed2.prerelease) return 1;
	if (parsed1.prerelease && !parsed2.prerelease) return -1;
	if (parsed1.prerelease && parsed2.prerelease) {
		return parsed1.prerelease.localeCompare(parsed2.prerelease);
	}

	return 0;
}

/**
 * Fetch latest versions from npm registry
 */
async function fetchLatestVersions(): Promise<{
	latest?: string;
	beta?: string;
}> {
	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 3000); // 3s timeout

		const response = await fetch(NPM_REGISTRY_URL, {
			signal: controller.signal,
			headers: {
				Accept: "application/json",
			},
		});

		clearTimeout(timeout);

		if (!response.ok) {
			return {};
		}

		const data = (await response.json()) as NpmPackageInfo;
		const latest = data["dist-tags"]?.latest;
		const beta = data["dist-tags"]?.beta;
		const result: { latest?: string; beta?: string } = {};
		if (latest) result.latest = latest;
		if (beta) result.beta = beta;
		return result;
	} catch {
		// Network error or timeout - fail silently
		return {};
	}
}

/**
 * Check if updates are available
 */
export async function checkForUpdates(): Promise<UpdateInfo | null> {
	try {
		const pkg = getPackageJson();
		const currentVersion = pkg.version;
		const { latest, beta } = await fetchLatestVersions();

		const hasLatestUpdate = latest
			? compareVersions(latest, currentVersion) > 0
			: false;
		const hasBetaUpdate = beta
			? compareVersions(beta, currentVersion) > 0
			: false;

		if (!hasLatestUpdate && !hasBetaUpdate) {
			return null;
		}

		const result: UpdateInfo = {
			currentVersion,
			hasLatestUpdate,
			hasBetaUpdate,
		};
		if (latest) result.latestVersion = latest;
		if (beta) result.betaVersion = beta;
		return result;
	} catch {
		return null;
	}
}

/**
 * Print update notification box
 */
export function printUpdateNotification(updateInfo: UpdateInfo): void {
	const boxChar = {
		topLeft: "┌",
		topRight: "┐",
		bottomLeft: "└",
		bottomRight: "┘",
		horizontal: "─",
		vertical: "│",
	};

	const lines: string[] = [];

	if (updateInfo.hasLatestUpdate && updateInfo.latestVersion) {
		lines.push(
			`🚀 Update available! ${pc.dim(updateInfo.currentVersion)} → ${pc.green(updateInfo.latestVersion)}`,
		);
		lines.push(`   Run: ${pc.cyan("npm install -g antigravity-kit@latest")}`);
	}

	if (updateInfo.hasBetaUpdate && updateInfo.betaVersion) {
		if (lines.length > 0) lines.push("");
		lines.push(
			`🧪 Beta available! ${pc.dim(updateInfo.currentVersion)} → ${pc.yellow(updateInfo.betaVersion)}`,
		);
		lines.push(`   Run: ${pc.cyan("npm install -g antigravity-kit@beta")}`);
	}

	if (lines.length === 0) return;

	// Calculate box width (account for ANSI codes)
	const stripAnsi = (str: string) =>
		str.replace(/\x1b\[[0-9;]*m/g, "");
	const maxLineLength = Math.max(...lines.map((l) => stripAnsi(l).length));
	const boxWidth = maxLineLength + 4;

	console.log();
	console.log(
		pc.dim(
			`${boxChar.topLeft}${boxChar.horizontal.repeat(boxWidth)}${boxChar.topRight}`,
		),
	);

	for (const line of lines) {
		const padding = boxWidth - stripAnsi(line).length - 2;
		console.log(
			pc.dim(boxChar.vertical) +
			` ${line}${" ".repeat(padding)} ` +
			pc.dim(boxChar.vertical),
		);
	}

	console.log(
		pc.dim(
			`${boxChar.bottomLeft}${boxChar.horizontal.repeat(boxWidth)}${boxChar.bottomRight}`,
		),
	);
	console.log();
}
