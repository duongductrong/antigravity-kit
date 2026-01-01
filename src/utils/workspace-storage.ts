import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { STATE_DB_PATH } from "../types/auth.js";
import { getDefaultAntigravityDataDir } from "./profile-manager.js";

export interface WorkspaceInfo {
	hash: string;
	folderPath: string;
	folderName: string;
	lastModified: Date;
}

interface WorkspaceJson {
	folder?: string;
}

/**
 * Get the path to the workspaceStorage directory
 */
export function getWorkspaceStoragePath(profilePath?: string): string {
	const baseDir = profilePath || getDefaultAntigravityDataDir();
	return join(baseDir, "User", "workspaceStorage");
}

/**
 * Parse a workspace.json file and extract the folder path
 */
export function parseWorkspaceJson(workspacePath: string): string | null {
	const jsonPath = join(workspacePath, "workspace.json");

	if (!existsSync(jsonPath)) {
		return null;
	}

	try {
		const content = readFileSync(jsonPath, "utf-8");
		const data: WorkspaceJson = JSON.parse(content);

		if (data.folder) {
			// Remove the file:// prefix if present
			return data.folder.replace(/^file:\/\//, "");
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * List all workspaces from workspaceStorage directory
 * Sorted by last modified (most recent first)
 */
export function listWorkspaces(profilePath?: string): WorkspaceInfo[] {
	const storagePath = getWorkspaceStoragePath(profilePath);

	if (!existsSync(storagePath)) {
		return [];
	}

	const workspaces: WorkspaceInfo[] = [];

	try {
		const entries = readdirSync(storagePath, { withFileTypes: true });

		for (const entry of entries) {
			if (!entry.isDirectory()) continue;

			const workspacePath = join(storagePath, entry.name);
			const folderPath = parseWorkspaceJson(workspacePath);

			if (!folderPath) continue;

			// Check if the folder still exists
			if (!existsSync(folderPath)) continue;

			const stats = statSync(workspacePath);
			const folderName = folderPath.split("/").pop() || folderPath;

			workspaces.push({
				hash: entry.name,
				folderPath,
				folderName,
				lastModified: stats.mtime,
			});
		}
	} catch {
		return [];
	}

	// Sort by last modified (most recent first)
	return workspaces.sort(
		(a, b) => b.lastModified.getTime() - a.lastModified.getTime(),
	);
}

/**
 * Get the most recently accessed workspace
 */
export function getLastOpenedWorkspace(
	profilePath?: string,
): WorkspaceInfo | null {
	const workspaces = listWorkspaces(profilePath);
	return workspaces.length > 0 ? workspaces[0] : null;
}

/**
 * Get a workspace by folder name (partial match)
 */
export function findWorkspaceByName(
	name: string,
	profilePath?: string,
): WorkspaceInfo | null {
	const workspaces = listWorkspaces(profilePath);
	const lowerName = name.toLowerCase();

	// First try exact match
	const exact = workspaces.find(
		(w) => w.folderName.toLowerCase() === lowerName,
	);
	if (exact) return exact;

	// Then try partial match
	return (
		workspaces.find((w) => w.folderName.toLowerCase().includes(lowerName)) ||
		null
	);
}

interface RecentlyOpenedPathsList {
	entries?: Array<{
		folderUri?: string;
		fileUri?: string;
	}>;
}

/**
 * Get the currently open workspace from state.vscdb
 * This reads the history.recentlyOpenedPathsList key which contains
 * the most recently opened folders, with the first entry being the current one.
 */
export function getCurrentWorkspaceFromState(
	profilePath?: string,
): string | null {
	const baseDir = profilePath || getDefaultAntigravityDataDir();
	const dbPath = join(baseDir, STATE_DB_PATH);

	if (!existsSync(dbPath)) {
		return null;
	}

	try {
		const db = new Database(dbPath, { readonly: true });

		const row = db
			.prepare(
				`SELECT value FROM ItemTable WHERE key = 'history.recentlyOpenedPathsList'`,
			)
			.get() as { value: string } | undefined;

		db.close();

		if (!row) {
			return null;
		}

		const data: RecentlyOpenedPathsList = JSON.parse(row.value);

		if (data.entries && data.entries.length > 0) {
			const firstEntry = data.entries[0];
			const uri = firstEntry?.folderUri || firstEntry?.fileUri;

			if (uri) {
				// Remove file:// prefix
				return uri.replace(/^file:\/\//, "");
			}
		}

		return null;
	} catch {
		return null;
	}
}
