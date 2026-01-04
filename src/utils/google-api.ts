/**
 * Google API Utilities
 *
 * Shared Google API functions for fetching user information.
 */

// ============================================
// CONFIGURATION
// ============================================

export const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

// ============================================
// TYPES
// ============================================

export interface UserInfo {
  email: string
  name?: string
  given_name?: string
  family_name?: string
  picture?: string
}

// ============================================
// API FUNCTIONS
// ============================================

/**
 * Get user info from access token
 */
export async function getUserInfo(accessToken: string): Promise<UserInfo> {
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to get user info: ${errorText}`)
  }

  return (await response.json()) as UserInfo
}
