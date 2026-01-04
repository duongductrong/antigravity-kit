/**
 * 
 * OAuth Authentication Utilities
 * 
 * Handles Google OAuth token management for Antigravity accounts.
 * 
 * Original Author: lbjlaq (https://github.com/lbjlaq)
 * License: CC-BY-NC-SA-4.0 (https://creativecommons.org/licenses/by-nc-sa/4.0/)
 * Note: This version contains modifications based on the original source code.
 */

// ============================================
// CONFIGURATION
// ============================================

export const CLIENT_ID =
  "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";
export const CLIENT_SECRET = "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";
export const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

// OAuth scopes
export const SCOPES = [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/cclog",
  "https://www.googleapis.com/auth/experimentsandconfigs",
];

// ============================================
// TYPES
// ============================================

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type?: string;
  refresh_token?: string;
}

// ============================================
// OAUTH FUNCTIONS
// ============================================

/**
 * Generate OAuth authorization URL
 */
export function getAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });

  return `${AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCode(
  code: string,
  redirectUri: string
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code: code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${errorText}`);
  }

  const tokenRes = (await response.json()) as TokenResponse;

  if (!tokenRes.refresh_token) {
    console.warn(
      "⚠️  Warning: No refresh_token returned. You may need to revoke access at https://myaccount.google.com/permissions"
    );
  }

  return tokenRes;
}

/**
 * Refresh an access token using a refresh token
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<TokenResponse> {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${errorText}`);
  }

  return (await response.json()) as TokenResponse;
}
