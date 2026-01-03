/**
 * Token Storage Utilities
 * 
 * Manages refresh token storage with secure keychain as default.
 * Cross-platform support via keytar:
 * - macOS: Keychain
 * - Windows: Credential Manager
 * - Linux: libsecret (GNOME Keyring / KWallet)
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

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
// KEYTAR LOADER (Cross-platform secure storage)
// ============================================

type Keytar = typeof import("keytar");

let keytarModule: Keytar | null = null;
let keytarLoadAttempted = false;

/**
 * Dynamically load keytar module
 * This allows graceful fallback if keytar is not available
 */
async function loadKeytar(): Promise<Keytar | null> {
  if (keytarLoadAttempted) {
    return keytarModule;
  }

  keytarLoadAttempted = true;

  try {
    keytarModule = await import("keytar");
    return keytarModule;
  } catch {
    // keytar not available (native bindings failed, not installed, etc.)
    return null;
  }
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
// KEYCHAIN STORAGE (Cross-platform via keytar)
// ============================================

/**
 * Check if keychain storage is available
 * Works on macOS (Keychain), Windows (Credential Manager), Linux (libsecret)
 */
export async function isKeychainAvailable(): Promise<boolean> {
  const keytar = await loadKeytar();
  if (!keytar) {
    return false;
  }

  // Test if keytar actually works by trying a harmless operation
  try {
    await keytar.findCredentials(KEYCHAIN_SERVICE);
    return true;
  } catch {
    return false;
  }
}

/**
 * Save token to system keychain
 */
async function saveToKeychain(email: string, refreshToken: string): Promise<boolean> {
  const keytar = await loadKeytar();
  if (!keytar) return false;

  try {
    await keytar.setPassword(KEYCHAIN_SERVICE, email, refreshToken);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get token from system keychain
 */
async function getFromKeychain(email: string): Promise<string | null> {
  const keytar = await loadKeytar();
  if (!keytar) return null;

  try {
    const password = await keytar.getPassword(KEYCHAIN_SERVICE, email);
    return password;
  } catch {
    return null;
  }
}

/**
 * Delete token from system keychain
 */
async function deleteFromKeychain(email: string): Promise<boolean> {
  const keytar = await loadKeytar();
  if (!keytar) return false;

  try {
    const deleted = await keytar.deletePassword(KEYCHAIN_SERVICE, email);
    return deleted;
  } catch {
    return false;
  }
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Save refresh token for an account
 * By default, uses system keychain unless insecure=true
 * @param email - Account email
 * @param refreshToken - OAuth refresh token
 * @param insecure - Store in local file instead of Keychain (default: false)
 */
export async function saveRefreshToken(
  email: string,
  refreshToken: string,
  insecure = false
): Promise<void> {
  const useKeychain = !insecure && await isKeychainAvailable();

  if (useKeychain) {
    const success = await saveToKeychain(email, refreshToken);
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
export async function getRefreshToken(email: string): Promise<string | null> {
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
export async function deleteRefreshToken(email: string): Promise<void> {
  const store = loadTokenStore();
  const entry = store[email];

  if (entry?.refreshToken === "[keychain]") {
    await deleteFromKeychain(email);
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
export async function hasStoredToken(email: string): Promise<boolean> {
  return (await getRefreshToken(email)) !== null;
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
export async function getTokenMetadata(email: string): Promise<TokenMetadata | null> {
  const store = loadTokenStore();
  const entry = store[email];

  if (!entry) return null;

  const isKeychain = entry.refreshToken === "[keychain]";
  const hasToken = isKeychain ? (await getFromKeychain(email)) !== null : true;

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
export async function getAllTokenMetadata(): Promise<TokenMetadata[]> {
  const store = loadTokenStore();
  const result: TokenMetadata[] = [];

  for (const email of Object.keys(store)) {
    const metadata = await getTokenMetadata(email);
    if (metadata) {
      result.push(metadata);
    }
  }

  return result;
}
