/**
 * Google Cloud Code Quota Client
 *
 * A standalone TypeScript module for fetching Google Cloud Code (Gemini/Claude)
 * quota information using OAuth tokens.
 *
 * Usage with existing refresh_token:
 *   import { getQuotaWithRefresh } from './google-quota-client';
 *   const result = await getQuotaWithRefresh('your-refresh-token');
 *
 * Usage with full OAuth flow (opens browser):
 *   import { startOAuthFlow } from './google-quota-client';
 *   const { tokens, quota } = await startOAuthFlow();
 *
 * CLI:
 *   npx tsx google-quota-client.ts              # Full OAuth flow
 *   npx tsx google-quota-client.ts <refresh>    # Use existing refresh token
 */

import * as http from "http";
import * as url from "url";
import { exec } from "child_process";
import * as os from "os";

// ============================================
// CONFIGURATION (from oauth.rs)
// ============================================

const CLIENT_ID =
  "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";
const CLIENT_SECRET = "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";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const CLOUD_CODE_BASE_URL = "https://cloudcode-pa.googleapis.com";
const QUOTA_API_URL = `${CLOUD_CODE_BASE_URL}/v1internal:fetchAvailableModels`;
const LOAD_CODE_ASSIST_URL = `${CLOUD_CODE_BASE_URL}/v1internal:loadCodeAssist`;
const USER_AGENT = "antigravity/1.11.3 Darwin/arm64";

// OAuth scopes (from oauth.rs)
const SCOPES = [
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

export interface UserInfo {
  email: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export interface ModelQuota {
  name: string;
  percentage: number;
  resetTime: string;
}

export interface QuotaResult {
  projectId?: string;
  subscriptionTier?: string;
  models: ModelQuota[];
  isForbidden?: boolean;
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

export interface OAuthFlowResult {
  tokens: TokenResponse & { refresh_token: string };
  userInfo: UserInfo;
  quota: QuotaResult;
}

// ============================================
// OAUTH FUNCTIONS (from oauth.rs)
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

  const tokenRes: TokenResponse = await response.json();

  console.log(
    `✅ Token exchange successful! access_token: ${tokenRes.access_token.substring(0, 20)}...`
  );

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

  return response.json();
}

/**
 * Get user info from access token
 */
export async function getUserInfo(accessToken: string): Promise<UserInfo> {
  const response = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get user info: ${errorText}`);
  }

  return response.json();
}

// ============================================
// QUOTA FUNCTIONS (from quota.rs)
// ============================================

/**
 * Fetch project ID and subscription tier
 */
export async function fetchProjectId(
  accessToken: string
): Promise<{ projectId?: string; subscriptionTier?: string }> {
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

  const data: LoadProjectResponse = await response.json();

  // Priority: paid_tier > current_tier
  const subscriptionTier = data.paidTier?.id || data.currentTier?.id;

  return {
    projectId: data.cloudaicompanionProject,
    subscriptionTier,
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

  const data: QuotaApiResponse = await response.json();
  const models: ModelQuota[] = [];

  for (const [name, info] of Object.entries(data.models)) {
    if (info.quotaInfo) {
      const percentage = info.quotaInfo.remainingFraction
        ? Math.round(info.quotaInfo.remainingFraction * 100)
        : 0;

      // Only include gemini and claude models
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
): Promise<QuotaResult & { email?: string }> {
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
    email,
    subscriptionTier: subscriptionTier || quotaResult.subscriptionTier,
  };
}

// ============================================
// OAUTH SERVER (from oauth_server.rs)
// ============================================

/**
 * Open URL in default browser
 */
function openBrowser(url: string): void {
  const platform = os.platform();
  let command: string;

  switch (platform) {
    case "darwin":
      command = `open "${url}"`;
      break;
    case "win32":
      command = `start "" "${url}"`;
      break;
    default:
      command = `xdg-open "${url}"`;
  }

  exec(command, (error) => {
    if (error) {
      console.error(`⚠️  Could not open browser: ${error.message}`);
      console.log(`\n📋 Please open this URL manually:\n${url}\n`);
    }
  });
}

/**
 * Start local HTTP server to capture OAuth callback
 */
function startCallbackServer(
  port: number
): Promise<{ server: http.Server; codePromise: Promise<string> }> {
  return new Promise((resolve) => {
    let resolveCode: (code: string) => void;
    let rejectCode: (err: Error) => void;

    const codePromise = new Promise<string>((res, rej) => {
      resolveCode = res;
      rejectCode = rej;
    });

    const server = http.createServer((req, res) => {
      const parsedUrl = url.parse(req.url || "", true);

      if (parsedUrl.pathname === "/oauth-callback") {
        const code = parsedUrl.query.code as string | undefined;

        if (code) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`
            <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: green;">✅ 授权成功! / Authorization Successful!</h1>
              <p>您可以关闭此窗口返回应用。/ You can close this window.</p>
              <script>setTimeout(function() { window.close(); }, 2000);</script>
            </body>
            </html>
          `);
          resolveCode(code);
        } else {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`
            <html>
            <body style="font-family: sans-serif; text-align: center; padding: 50px;">
              <h1 style="color: red;">❌ 授权失败 / Authorization Failed</h1>
              <p>未能获取授权 Code，请重试。/ Could not get authorization code.</p>
            </body>
            </html>
          `);
          rejectCode(new Error("No authorization code received"));
        }
      }
    });

    server.listen(port, "127.0.0.1", () => {
      resolve({ server, codePromise });
    });
  });
}

/**
 * Full OAuth flow: opens browser, captures callback, exchanges for tokens
 */
export async function startOAuthFlow(): Promise<OAuthFlowResult> {
  // Find available port
  const port = 8085 + Math.floor(Math.random() * 100);
  const redirectUri = `http://127.0.0.1:${port}/oauth-callback`;

  console.log("🚀 Starting OAuth flow...");
  console.log(`📡 Callback server listening on port ${port}`);

  // Start callback server
  const { server, codePromise } = await startCallbackServer(port);

  // Generate and open auth URL
  const authUrl = getAuthUrl(redirectUri);
  console.log("\n🌐 Opening browser for authorization...");
  console.log(`\n📋 If browser doesn't open, visit:\n${authUrl}\n`);
  openBrowser(authUrl);

  try {
    // Wait for callback
    console.log("⏳ Waiting for authorization...");
    const code = await codePromise;
    console.log("✅ Authorization code received!");

    // Exchange code for tokens
    console.log("🔄 Exchanging code for tokens...");
    const tokens = await exchangeCode(code, redirectUri);

    if (!tokens.refresh_token) {
      throw new Error(
        "No refresh_token received. Visit https://myaccount.google.com/permissions to revoke access and try again."
      );
    }

    // Get user info
    console.log("👤 Fetching user info...");
    const userInfo = await getUserInfo(tokens.access_token);
    console.log(`✅ Logged in as: ${userInfo.email}`);

    // Get quota
    console.log("📊 Fetching quota...");
    const { projectId, subscriptionTier } = await fetchProjectId(
      tokens.access_token
    );
    const quota = await fetchQuota(tokens.access_token, projectId);
    quota.subscriptionTier = subscriptionTier;

    return {
      tokens: tokens as TokenResponse & { refresh_token: string },
      userInfo,
      quota,
    };
  } finally {
    server.close();
  }
}

// ============================================
// CLI RUNNER
// ============================================

function printQuota(result: QuotaResult & { email?: string }): void {
  console.log("\n" + "=".repeat(50));
  console.log("QUOTA RESULT");
  console.log("=".repeat(50));

  if (result.email) {
    console.log(`📧 Email: ${result.email}`);
  }
  if (result.projectId) {
    console.log(`🏗️  Project ID: ${result.projectId}`);
  }
  if (result.subscriptionTier) {
    console.log(`💎 Subscription: ${result.subscriptionTier}`);
  }
  if (result.isForbidden) {
    console.log(`🚫 Status: FORBIDDEN (403)`);
  }

  console.log(`\n📊 Models (${result.models.length}):`);
  console.log("-".repeat(50));

  for (const model of result.models) {
    const bar = "█".repeat(Math.floor(model.percentage / 5));
    const empty = "░".repeat(20 - Math.floor(model.percentage / 5));
    console.log(`  ${model.name}`);
    console.log(`    [${bar}${empty}] ${model.percentage}%`);
    if (model.resetTime) {
      console.log(`    📅 Reset: ${model.resetTime}`);
    }
  }

  console.log("=".repeat(50));
}

async function main() {
  const refreshToken = process.env.REFRESH_TOKEN || process.argv[2];

  try {
    if (refreshToken) {
      // Use existing refresh token
      console.log("🔑 Using provided refresh token...\n");
      const result = await getQuotaWithRefresh(refreshToken);
      printQuota(result);
    } else {
      // Full OAuth flow
      console.log("No refresh token provided. Starting full OAuth flow...\n");
      const result = await startOAuthFlow();

      printQuota({ ...result.quota, email: result.userInfo.email });

      // Print refresh token for future use
      console.log("\n" + "=".repeat(50));
      console.log("🔑 REFRESH TOKEN (save this for future use):");
      console.log("-".repeat(50));
      console.log(result.tokens.refresh_token);
      console.log("=".repeat(50));
    }
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

main();
