export interface Profile {
	id: string;
	email: string;
	name: string;
	profilePath: string;
	createdAt: number;
	updatedAt: number;
}

export interface ProfileStore {
	profiles: Profile[];
	activeProfileId: string | null;
	version: number;
}

export interface AuthSession {
	id: string;
	account: {
		label: string;
		id: string;
	};
	scopes?: string[];
}

export interface AuthSessionData {
	email: string;
	accountId: string;
	sessionId: string;
	name?: string;
}

export const PROFILES_DIR_NAME = "profiles";
export const PENDING_SESSION_NAME = "pending_session";
export const ACTIVE_SYMLINK_NAME = "active";
export const CONFIG_FILE_NAME = "config.json";
export const STATE_DB_PATH = "User/globalStorage/state.vscdb";

export const CLEANUP_DIRECTORIES = [
	"Cache",
	"CachedData",
	"logs",
	"Crashpad",
	"GPUCache",
	"blob_storage",
	"Code Cache",
	"DawnCache",
	"Service Worker",
];
