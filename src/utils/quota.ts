/**
 * Quota Fetching Utilities
 * 
 * Handles fetching quota information from Google Cloud Code API.
 */

import { refreshAccessToken } from "./oauth.js";
import { getUserInfo } from "./google-api.js";

// ============================================
// CONFIGURATION
// ============================================

export const CLOUD_CODE_BASE_URL = "https://cloudcode-pa.googleapis.com";
export const QUOTA_API_URL = `${CLOUD_CODE_BASE_URL}/v1internal:fetchAvailableModels`;
export const LOAD_CODE_ASSIST_URL = `${CLOUD_CODE_BASE_URL}/v1internal:loadCodeAssist`;
export const USER_AGENT = "antigravity/1.11.3 Darwin/arm64";

// ============================================
// TYPES
// ============================================

export interface ModelQuota {
  name: string;
  percentage: number;
  resetTime: string;
}

export interface QuotaResult {
  projectId?: string | undefined;
  subscriptionTier?: string | undefined;
  models: ModelQuota[];
  isForbidden?: boolean | undefined;
}

interface LoadProjectResponse {
  cloudaicompanionProject?: string;
  currentTier?: { id?: string; quotaTier?: string; name?: string };
  paidTier?: { id?: string; quotaTier?: string; name?: string };
}

interface QuotaApiResponse {
  models: Record<
    string,
    {
      quotaInfo?: {
        remainingFraction?: number;
        resetTime?: string;
      };
    }
  >;
}

// ============================================
// QUOTA FUNCTIONS
// ============================================

/**
 * Fetch project ID and subscription tier
 */
export async function fetchProjectId(
  accessToken: string
): Promise<{ projectId?: string | undefined; subscriptionTier?: string | undefined }> {
  const response = await fetch(LOAD_CODE_ASSIST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "User-Agent": "antigravity/windows/amd64",
    },
    body: JSON.stringify({ metadata: { ideType: "ANTIGRAVITY" } }),
  });

  if (!response.ok) {
    console.warn(`⚠️  loadCodeAssist failed: ${response.status}`);
    return {};
  }

  const data = (await response.json()) as LoadProjectResponse;

  // Priority: paid_tier > current_tier
  const subscriptionTier = data.paidTier?.id || data.currentTier?.id;

  return {
    projectId: data.cloudaicompanionProject ?? undefined,
    subscriptionTier: subscriptionTier ?? undefined,
  };
}

/**
 * Fetch quota information for available models
 */
export async function fetchQuota(
  accessToken: string,
  projectId?: string
): Promise<QuotaResult> {
  const finalProjectId = projectId || "bamboo-precept-lgxtn";

  const response = await fetch(QUOTA_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({ project: finalProjectId }),
  });

  // Handle 403 Forbidden
  if (response.status === 403) {
    console.warn("⚠️  Account forbidden (403)");
    return { models: [], isForbidden: true };
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Quota API error: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as QuotaApiResponse;
  const models: ModelQuota[] = [];

  for (const [name, info] of Object.entries(data.models)) {
    if (info.quotaInfo) {
      const percentage = info.quotaInfo.remainingFraction
        ? Math.round(info.quotaInfo.remainingFraction * 100)
        : 0;

      // Include all gemini and claude models
      if (name.includes("gemini") || name.includes("claude")) {
        models.push({
          name,
          percentage,
          resetTime: info.quotaInfo.resetTime || "",
        });
      }
    }
  }

  return { models, projectId: finalProjectId };
}

/**
 * Get quota using refresh token (simple flow)
 */
export async function getQuotaWithRefresh(
  refreshToken: string
): Promise<QuotaResult & { email?: string | undefined }> {
  // 1. Refresh access token
  const tokenResponse = await refreshAccessToken(refreshToken);
  const accessToken = tokenResponse.access_token;

  // 2. Get user info
  let email: string | undefined;
  try {
    const userInfo = await getUserInfo(accessToken);
    email = userInfo.email;
  } catch {
    console.warn("⚠️  Could not fetch user info");
  }

  // 3. Get project ID and subscription tier
  const { projectId, subscriptionTier } = await fetchProjectId(accessToken);

  // 4. Fetch quota
  const quotaResult = await fetchQuota(accessToken, projectId);

  return {
    ...quotaResult,
    email: email ?? undefined,
    subscriptionTier: subscriptionTier ?? quotaResult.subscriptionTier ?? undefined,
  };
}
