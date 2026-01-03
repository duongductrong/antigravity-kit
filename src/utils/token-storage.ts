/**
 * Token Storage Utilities
 * 
 * Manages refresh token storage with Keychain as default on macOS.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

// ============================================
// CONFIGURATION
// ============================================

const BASE_DIR = join(homedir(), ".antigravity-kit");
const TOKENS_FILE = join(BASE_DIR, "tokens.json");
const KEYCHAIN_SERVICE = "antigravity-kit";

// ============================================
// TYPES
// ============================================

interface TokenEntry {
  refreshToken: string;
  createdAt: number;
  updatedAt: number;
}

interface TokenStore {
  [email: string]: TokenEntry;
}

export interface TokenMetadata {
  email: string;
  createdAt: number;
  updatedAt: number;
  isKeychain: boolean;
  hasToken: boolean;
}

// ============================================
// FILE-BASED STORAGE
// ============================================

function ensureBaseDir(): void {
  if (!existsSync(BASE_DIR)) {
    mkdirSync(BASE_DIR, { recursive: true });
  }
}

function loadTokenStore(): TokenStore {
  ensureBaseDir();
  if (!existsSync(TOKENS_FILE)) {
    return {};
  }
  try {
    const content = readFileSync(TOKENS_FILE, "utf-8");
    return JSON.parse(content) as TokenStore;
  } catch {
    return {};
  }
}

function saveTokenStore(store: TokenStore): void {
  ensureBaseDir();
  writeFileSync(TOKENS_FILE, JSON.stringify(store, null, 2));
}

// ============================================
// KEYCHAIN STORAGE (macOS)
// ============================================

/**
 * Check if keychain storage is available (macOS only)
 */
export function isKeychainAvailable(): boolean {
  return platform() === "darwin";
}

/**
 * Save token to macOS Keychain
 */
function saveToKeychain(email: string, refreshToken: string): boolean {
  if (!isKeychainAvailable()) return false;

  try {
    // Delete existing entry first (ignore errors if not found)
    try {
      execSync(
        `security delete-generic-password -s "${KEYCHAIN_SERVICE}" -a "${email}" 2>/dev/null`,
        { stdio: "ignore" }
      );
    } catch {
      // Ignore - entry might not exist
    }

    // Add new entry
    execSync(
      `security add-generic-password -s "${KEYCHAIN_SERVICE}" -a "${email}" -w "${refreshToken}"`,
      { stdio: "ignore" }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Get token from macOS Keychain
 */
function getFromKeychain(email: string): string | null {
  if (!isKeychainAvailable()) return null;

  try {
    const result = execSync(
      `security find-generic-password -s "${KEYCHAIN_SERVICE}" -a "${email}" -w 2>/dev/null`,
      { encoding: "utf-8" }
    );
    return result.trim();
  } catch {
    return null;
  }
}

/**
 * Delete token from macOS Keychain
 */
function deleteFromKeychain(email: string): boolean {
  if (!isKeychainAvailable()) return false;

  try {
    execSync(
      `security delete-generic-password -s "${KEYCHAIN_SERVICE}" -a "${email}" 2>/dev/null`,
      { stdio: "ignore" }
    );
    return true;
  } catch {
    return false;
  }
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Save refresh token for an account
 * By default, uses Keychain on macOS unless insecure=true
 * @param email - Account email
 * @param refreshToken - OAuth refresh token
 * @param insecure - Store in local file instead of Keychain (default: false)
 */
export function saveRefreshToken(
  email: string,
  refreshToken: string,
  insecure = false
): void {
  const useKeychain = !insecure && isKeychainAvailable();

  if (useKeychain) {
    const success = saveToKeychain(email, refreshToken);
    if (success) {
      // Save metadata (without token) to file for tracking
      const store = loadTokenStore();
      store[email] = {
        refreshToken: "[keychain]",
        createdAt: store[email]?.createdAt || Date.now(),
        updatedAt: Date.now(),
      };
      saveTokenStore(store);
      return;
    }
    // Fall back to file storage if keychain fails
    console.warn("⚠️  Keychain storage failed, using file storage");
  }

  const store = loadTokenStore();
  store[email] = {
    refreshToken,
    createdAt: store[email]?.createdAt || Date.now(),
    updatedAt: Date.now(),
  };
  saveTokenStore(store);
}

/**
 * Get refresh token for an account
 * @param email - Account email
 * @returns Refresh token or null if not found
 */
export function getRefreshToken(email: string): string | null {
  const store = loadTokenStore();
  const entry = store[email];

  if (!entry) return null;

  // Check if token is in keychain
  if (entry.refreshToken === "[keychain]") {
    return getFromKeychain(email);
  }

  return entry.refreshToken;
}

/**
 * Delete refresh token for an account
 * @param email - Account email
 */
export function deleteRefreshToken(email: string): void {
  const store = loadTokenStore();
  const entry = store[email];

  if (entry?.refreshToken === "[keychain]") {
    deleteFromKeychain(email);
  }

  delete store[email];
  saveTokenStore(store);
}

/**
 * List all accounts with stored tokens
 */
export function listStoredAccounts(): string[] {
  const store = loadTokenStore();
  return Object.keys(store);
}

/**
 * Check if an account has a stored token
 */
export function hasStoredToken(email: string): boolean {
  return getRefreshToken(email) !== null;
}

/**
 * Check if an account's token is stored in Keychain
 */
export function isTokenInKeychain(email: string): boolean {
  const store = loadTokenStore();
  const entry = store[email];
  return entry?.refreshToken === "[keychain]";
}

/**
 * Get token metadata for an account
 */
export function getTokenMetadata(email: string): TokenMetadata | null {
  const store = loadTokenStore();
  const entry = store[email];

  if (!entry) return null;

  const isKeychain = entry.refreshToken === "[keychain]";
  const hasToken = isKeychain ? getFromKeychain(email) !== null : true;

  return {
    email,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    isKeychain,
    hasToken,
  };
}

/**
 * Get all token metadata
 */
export function getAllTokenMetadata(): TokenMetadata[] {
  const store = loadTokenStore();
  const result: TokenMetadata[] = [];

  for (const email of Object.keys(store)) {
    const metadata = getTokenMetadata(email);
    if (metadata) {
      result.push(metadata);
    }
  }

  return result;
}
