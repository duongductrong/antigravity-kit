import Database from "better-sqlite3";
import type { AuthSessionData } from "../types/auth.js";

interface AntigravityAuthStatus {
	name?: string;
	email?: string;
	apiKey?: string;
	userStatusProtoBinaryBase64?: string;
}

export function readAuthSessions(dbPath: string): AuthSessionData[] {
	try {
		const db = new Database(dbPath, { readonly: true });

		// Antigravity stores auth in 'antigravityAuthStatus' key
		const query = `
			SELECT key, value FROM ItemTable 
			WHERE key = 'antigravityAuthStatus'
			   OR key LIKE '%authentication.sessions%' 
			   OR key LIKE '%google.auth%'
			   OR key LIKE '%auth.sessions%'
		`;

		const rows = db.prepare(query).all() as Array<{
			key: string;
			value: string;
		}>;
		db.close();

		const sessions: AuthSessionData[] = [];

		for (const row of rows) {
			// Handle Antigravity-specific auth format
			if (row.key === "antigravityAuthStatus") {
				const authData = parseAntigravityAuth(row.value);
				if (authData) {
					sessions.push(authData);
				}
			} else {
				// Fallback for other auth formats
				const parsed = parseAuthSession(row.value);
				if (parsed) {
					sessions.push(...parsed);
				}
			}
		}

		return sessions;
	} catch {
		return [];
	}
}

function parseAntigravityAuth(jsonValue: string): AuthSessionData | null {
	try {
		const parsed = JSON.parse(jsonValue) as AntigravityAuthStatus;

		if (parsed.email) {
			const result: AuthSessionData = {
				email: parsed.email,
				accountId: parsed.email,
				sessionId: parsed.apiKey?.substring(0, 20) || "antigravity",
			};

			if (parsed.name) {
				result.name = parsed.name;
			}

			return result;
		}

		return null;
	} catch {
		return null;
	}
}

export function parseAuthSession(jsonValue: string): AuthSessionData[] | null {
	try {
		const parsed = JSON.parse(jsonValue);
		const sessions: AuthSessionData[] = [];

		if (Array.isArray(parsed)) {
			for (const item of parsed) {
				const sessionData = extractSessionData(item);
				if (sessionData) {
					sessions.push(sessionData);
				}
			}
		} else if (typeof parsed === "object" && parsed !== null) {
			const sessionData = extractSessionData(parsed);
			if (sessionData) {
				sessions.push(sessionData);
			}
		}

		return sessions.length > 0 ? sessions : null;
	} catch {
		return null;
	}
}

interface AuthAccount {
	label?: string;
	id?: string;
}

interface AuthSessionItem {
	id?: string;
	account?: AuthAccount;
}

function extractSessionData(item: unknown): AuthSessionData | null {
	if (typeof item !== "object" || item === null) {
		return null;
	}

	const session = item as AuthSessionItem;

	if (session.account?.label && session.account?.id) {
		return {
			email: session.account.label,
			accountId: session.account.id,
			sessionId: session.id || "unknown",
		};
	}

	return null;
}

export function hasAuthSessions(dbPath: string): boolean {
	const sessions = readAuthSessions(dbPath);
	return sessions.length > 0;
}

export function getFirstAuthSession(dbPath: string): AuthSessionData | null {
	const sessions = readAuthSessions(dbPath);
	return sessions[0] ?? null;
}

