// Types
export type {
	AuthSession,
	AuthSessionData,
	Profile,
	ProfileStore,
} from "./types/auth.js";

export {
	ACTIVE_SYMLINK_NAME,
	CLEANUP_DIRECTORIES,
	CONFIG_FILE_NAME,
	PENDING_SESSION_NAME,
	PROFILES_DIR_NAME,
	STATE_DB_PATH,
} from "./types/auth.js";

// Profile Manager utilities
export {
	addProfileAndSetActive,
	cleanupProfile,
	copyDefaultProfileToStorage,
	createPendingProfile,
	finalizeProfile,
	formatSize,
	generateProfileId,
	getActiveProfileEmail,
	getDefaultAntigravityDataDir,
	getDefaultStateDbPath,
	getPendingProfilePath,
	getProfileByEmail,
	getProfileSize,
	getProfilesDir,
	getStateDbPath,
	listProfiles,
	removeProfile,
	watchForAuth,
} from "./utils/profile-manager.js";

// SQLite Reader utilities
export {
	getFirstAuthSession,
	hasAuthSessions,
	parseAuthSession,
	readAuthSessions,
} from "./utils/sqlite-reader.js";

// Symlink Manager utilities
export {
	getActiveProfileName,
	getActiveProfilePath,
	getActiveSymlinkPath,
	isActiveProfile,
	removeActiveSymlink,
	setActiveProfile,
} from "./utils/symlink-manager.js";

// Antigravity Launcher utilities
export {
	isAntigravityInstalled,
	openAntigravity,
} from "./utils/antigravity-launcher.js";

// Branding utilities
export {
	printBanner,
	printCommand,
	printError,
	printHeader,
	printInfo,
	printSuccess,
	printVersion,
	printWarning,
} from "./utils/branding.js";
