import { exec, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { platform } from "node:os";
import { promisify } from "node:util";

const execAsync = promisify(exec);

function getAntigravityPath(): string | null {
	const os = platform();

	if (os === "darwin") {
		const paths = [
			"/Applications/Antigravity.app",
			`${process.env["HOME"]}/Applications/Antigravity.app`,
		];
		for (const p of paths) {
			if (existsSync(p)) {
				return p;
			}
		}
	} else if (os === "linux") {
		const paths = ["/usr/bin/antigravity", "/usr/local/bin/antigravity"];
		for (const p of paths) {
			if (existsSync(p)) {
				return p;
			}
		}
	} else if (os === "win32") {
		const localAppData = process.env["LOCALAPPDATA"] || "";
		const paths = [
			"C:\\Program Files\\Antigravity\\antigravity.exe",
			`${localAppData}\\Programs\\Antigravity\\antigravity.exe`,
		];
		for (const p of paths) {
			if (existsSync(p)) {
				return p;
			}
		}
	}

	return null;
}

export async function openAntigravity(profilePath?: string): Promise<void> {
	const os = platform();

	if (os === "darwin") {
		const appPath = getAntigravityPath();
		if (!appPath) {
			throw new Error(
				"Antigravity.app not found in /Applications or ~/Applications",
			);
		}

		// Note: Antigravity may ignore --user-data-dir, so we just open it
		// and let it use its default data directory
		if (profilePath) {
			await execAsync(
				`open -a "${appPath}" --args --user-data-dir="${profilePath}"`,
			);
		} else {
			await execAsync(`open -a "${appPath}"`);
		}
	} else if (os === "linux") {
		const binPath = getAntigravityPath();
		if (!binPath) {
			throw new Error("antigravity command not found");
		}

		const args = profilePath ? [`--user-data-dir=${profilePath}`] : [];
		spawn(binPath, args, {
			detached: true,
			stdio: "ignore",
		}).unref();
	} else if (os === "win32") {
		const exePath = getAntigravityPath();
		if (!exePath) {
			throw new Error("antigravity.exe not found");
		}

		const args = profilePath ? [`--user-data-dir=${profilePath}`] : [];
		spawn(exePath, args, {
			detached: true,
			stdio: "ignore",
			shell: true,
		}).unref();
	} else {
		throw new Error(`Unsupported platform: ${os}`);
	}
}

export function isAntigravityInstalled(): boolean {
	return getAntigravityPath() !== null;
}

export async function isAntigravityRunning(): Promise<boolean> {
	const os = platform();

	try {
		if (os === "darwin") {
			const { stdout } = await execAsync('pgrep -li "Antigravity"');
			return stdout.trim().length > 0;
		}

		if (os === "linux") {
			const { stdout } = await execAsync("pgrep -x antigravity");
			return stdout.trim().length > 0;
		}

		if (os === "win32") {
			const { stdout } = await execAsync(
				'tasklist /FI "IMAGENAME eq antigravity.exe" /NH',
			);
			return stdout.toLowerCase().includes("antigravity.exe");
		}

		return false;
	} catch {
		return false;
	}
}

export async function quitAntigravity(): Promise<boolean> {
	const os = platform();

	try {
		if (os === "darwin") {
			// await execAsync('osascript -e \'quit app "Antigravity"\'');
			await execAsync('pkill -9 -f "Antigravity"');
		} else if (os === "linux") {
			await execAsync("pkill -x antigravity");
		} else if (os === "win32") {
			await execAsync("taskkill /IM antigravity.exe /F");
		}

		await new Promise((resolve) => setTimeout(resolve, 500));
		return true;
	} catch {
		return false;
	}
}
