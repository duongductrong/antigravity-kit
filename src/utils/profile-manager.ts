import {
	cpSync,
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	renameSync,
	rmSync,
	statSync,
	watch,
	type FSWatcher,
} from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import type { AuthSessionData, Profile } from "../types/auth.js";
import {
	CLEANUP_DIRECTORIES,
	PENDING_SESSION_NAME,
	PROFILES_DIR_NAME,
	STATE_DB_PATH,
} from "../types/auth.js";
import { getFirstAuthSession } from "./sqlite-reader.js";
import { isActiveProfile, setActiveProfile } from "./symlink-manager.js";

function getBaseDir(): string {
	return join(homedir(), ".antigravity-kit");
}

export function getProfilesDir(): string {
	return join(getBaseDir(), PROFILES_DIR_NAME);
}

export function getDefaultAntigravityDataDir(): string {
	const os = platform();
	if (os === "darwin") {
		return join(homedir(), "Library", "Application Support", "Antigravity");
	}
	if (os === "win32") {
		return join(
			process.env["APPDATA"] || join(homedir(), "AppData", "Roaming"),
			"Antigravity",
		);
	}
	// Linux
	return join(homedir(), ".config", "Antigravity");
}

export function getDefaultStateDbPath(): string {
	return join(getDefaultAntigravityDataDir(), STATE_DB_PATH);
}

export function ensureProfilesDir(): void {
	const profilesDir = getProfilesDir();
	if (!existsSync(profilesDir)) {
		mkdirSync(profilesDir, { recursive: true });
	}
}

export function getPendingProfilePath(): string {
	return join(getProfilesDir(), PENDING_SESSION_NAME);
}

export function getStateDbPath(profilePath: string): string {
	return join(profilePath, STATE_DB_PATH);
}

export function createPendingProfile(): string {
	ensureProfilesDir();
	const pendingPath = getPendingProfilePath();

	if (existsSync(pendingPath)) {
		rmSync(pendingPath, { recursive: true, force: true });
	}

	mkdirSync(pendingPath, { recursive: true });
	return pendingPath;
}

export function cleanupProfile(profilePath: string): void {
	for (const dirName of CLEANUP_DIRECTORIES) {
		const dirPath = join(profilePath, dirName);
		if (existsSync(dirPath)) {
			try {
				rmSync(dirPath, { recursive: true, force: true });
			} catch {
				// Ignore cleanup errors
			}
		}
	}
}

export function finalizeProfile(pendingPath: string, email: string): string {
	const safeEmail = email.replace(/[^a-zA-Z0-9@._-]/g, "_");
	const finalPath = join(getProfilesDir(), safeEmail);

	if (existsSync(finalPath)) {
		rmSync(finalPath, { recursive: true, force: true });
	}

	renameSync(pendingPath, finalPath);
	return finalPath;
}

export function getProfileSize(profilePath: string): number {
	let totalSize = 0;

	function calculateSize(dirPath: string): void {
		try {
			const entries = readdirSync(dirPath, { withFileTypes: true });
			for (const entry of entries) {
				const fullPath = join(dirPath, entry.name);
				if (entry.isDirectory()) {
					calculateSize(fullPath);
				} else if (entry.isFile()) {
					totalSize += statSync(fullPath).size;
				}
			}
		} catch {
			// Ignore errors
		}
	}

	calculateSize(profilePath);
	return totalSize;
}

export function formatSize(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024)
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function listProfiles(): Profile[] {
	ensureProfilesDir();
	const profilesDir = getProfilesDir();
	const profiles: Profile[] = [];

	try {
		const entries = readdirSync(profilesDir, { withFileTypes: true });

		for (const entry of entries) {
			if (!entry.isDirectory()) continue;
			if (entry.name === PENDING_SESSION_NAME) continue;

			const profilePath = join(profilesDir, entry.name);
			const stats = statSync(profilePath);

			profiles.push({
				id: entry.name,
				email: entry.name,
				name: entry.name,
				profilePath,
				createdAt: stats.birthtimeMs,
				updatedAt: stats.mtimeMs,
			});
		}
	} catch {
		// Return empty array on error
	}

	return profiles;
}

export function getProfileByEmail(email: string): Profile | null {
	const profiles = listProfiles();
	return profiles.find((p) => p.email === email) ?? null;
}

export function removeProfile(profilePath: string): boolean {
	try {
		if (existsSync(profilePath)) {
			rmSync(profilePath, { recursive: true, force: true });
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

export interface WatchResult {
	session: AuthSessionData;
}

export function watchForAuth(
	timeoutMs: number = 300000,
): Promise<WatchResult> {
	return new Promise((resolve, reject) => {
		// Watch the DEFAULT Antigravity data directory, not custom profile
		// because Antigravity doesn't respect --user-data-dir argument
		const dbPath = getDefaultStateDbPath();
		const dbDir = join(getDefaultAntigravityDataDir(), "User", "globalStorage");
		let watcher: FSWatcher | null = null;
		let checkInterval: NodeJS.Timeout | null = null;
		let timeoutId: NodeJS.Timeout | null = null;
		let initialAuthState: AuthSessionData | null = null;

		const cleanup = () => {
			if (watcher) {
				watcher.close();
				watcher = null;
			}
			if (checkInterval) {
				clearInterval(checkInterval);
				checkInterval = null;
			}
			if (timeoutId) {
				clearTimeout(timeoutId);
				timeoutId = null;
			}
		};

		// Capture initial auth state to detect NEW logins
		if (existsSync(dbPath)) {
			initialAuthState = getFirstAuthSession(dbPath);
		}

		const checkForAuth = () => {
			if (!existsSync(dbPath)) {
				return false;
			}

			const session = getFirstAuthSession(dbPath);
			if (session) {
				// Check if this is a NEW login (different from initial state)
				// or if there was no initial auth
				const isNewLogin =
					!initialAuthState || session.email !== initialAuthState.email;

				if (isNewLogin) {
					cleanup();
					resolve({ session });
					return true;
				}
			}
			return false;
		};

		// Set timeout
		timeoutId = setTimeout(() => {
			cleanup();
			reject(new Error("Authentication timeout - no login detected"));
		}, timeoutMs);

		// Periodic check (main mechanism since file watching can be unreliable)
		checkInterval = setInterval(() => {
			checkForAuth();
		}, 2000);

		// Watch for file changes as backup
		const startWatcher = () => {
			try {
				if (existsSync(dbDir)) {
					watcher = watch(dbDir, (_eventType, filename) => {
						if (filename === "state.vscdb") {
							checkForAuth();
						}
					});
				}
			} catch {
				// Fall back to interval checking only
			}
		};

		// Start watching after a short delay
		setTimeout(startWatcher, 1000);
	});
}

export function copyDefaultProfileToStorage(email: string): string {
	const defaultDataDir = getDefaultAntigravityDataDir();
	const safeEmail = email.replace(/[^a-zA-Z0-9@._-]/g, "_");
	const profilePath = join(getProfilesDir(), safeEmail);

	ensureProfilesDir();

	// Remove existing profile if exists
	if (existsSync(profilePath)) {
		rmSync(profilePath, { recursive: true, force: true });
	}

	// Copy the entire default Antigravity data directory
	// Filter out socket files and other special files that cannot be copied
	cpSync(defaultDataDir, profilePath, {
		recursive: true,
		filter: (source) => {
			try {
				const stats = lstatSync(source);
				// Skip socket files, FIFOs, and device files (only copy files, directories, and symlinks)
				if (
					stats.isSocket() ||
					stats.isFIFO() ||
					stats.isBlockDevice() ||
					stats.isCharacterDevice()
				) {
					return false;
				}
				return true;
			} catch {
				// If we can't stat the file, skip it to be safe
				return false;
			}
		},
	});

	// Clean up cache directories to save space
	cleanupProfile(profilePath);

	return profilePath;
}

export class AntigravityRunningError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "AntigravityRunningError";
	}
}

export function restoreProfileToDefault(profilePath: string): boolean {
	const defaultDataDir = getDefaultAntigravityDataDir();

	if (!existsSync(profilePath)) {
		return false;
	}

	// Remove existing default data directory
	if (existsSync(defaultDataDir)) {
		try {
			rmSync(defaultDataDir, { recursive: true, force: true });
		} catch (error) {
			if (
				error instanceof Error &&
				(error.message.includes("ENOTEMPTY") ||
					error.message.includes("EBUSY") ||
					error.message.includes("EPERM"))
			) {
				throw new AntigravityRunningError(
					"Cannot switch profile while Antigravity is running. Please close Antigravity and try again.",
				);
			}
			throw error;
		}
	}

	// Copy profile data to the default Antigravity data directory
	// Filter out socket files and other special files that cannot be copied
	cpSync(profilePath, defaultDataDir, {
		recursive: true,
		filter: (source) => {
			try {
				const stats = lstatSync(source);
				// Skip socket files, FIFOs, and device files (only copy files, directories, and symlinks)
				if (
					stats.isSocket() ||
					stats.isFIFO() ||
					stats.isBlockDevice() ||
					stats.isCharacterDevice()
				) {
					return false;
				}
				return true;
			} catch {
				// If we can't stat the file, skip it to be safe
				return false;
			}
		},
	});

	return true;
}

export function generateProfileId(): string {
	return `profile_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function addProfileAndSetActive(
	email: string,
	profilePath: string,
): Profile {
	const profile: Profile = {
		id: generateProfileId(),
		email,
		name: email,
		profilePath,
		createdAt: Date.now(),
		updatedAt: Date.now(),
	};

	setActiveProfile(profilePath);

	return profile;
}

export function getActiveProfileEmail(): string | null {
	const profiles = listProfiles();
	const activeProfile = profiles.find((p) => isActiveProfile(p.profilePath));
	return activeProfile?.email ?? null;
}

