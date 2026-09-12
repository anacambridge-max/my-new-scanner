/**
 * Upstox Token Manager – Server-side ONLY
 *
 * SECURITY: Access token is NEVER sent to the client.
 * All Upstox API calls must be made from server-side code.
 *
 * Token storage: in-memory (development) or database (production).
 * Existing Supabase persistence is handled via the DB table if configured.
 */

import { db } from "@/db";
import { sql } from "drizzle-orm";

export interface UpstoxTokenData {
  accessToken: string;
  tokenType: string;
  expiresAt: string | null; // ISO timestamp
  refreshedAt: string;
  userProfile?: Record<string, unknown>;
}

// In-memory fallback for development / non-DB environments
let memoryToken: UpstoxTokenData | null = null;

// ─── Database Token Persistence ──────────────────────────────────────────────

async function ensureTokenTable(): Promise<void> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS upstox_tokens (
        id SERIAL PRIMARY KEY,
        access_token TEXT NOT NULL,
        token_type TEXT NOT NULL DEFAULT 'Bearer',
        expires_at TIMESTAMPTZ,
        refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        user_profile JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
  } catch {
    // Table creation failure is non-fatal in this context
  }
}

export async function saveToken(data: UpstoxTokenData): Promise<void> {
  // Always keep in-memory copy
  memoryToken = data;

  try {
    await ensureTokenTable();
    await db.execute(sql`
      INSERT INTO upstox_tokens (access_token, token_type, expires_at, refreshed_at, user_profile, updated_at)
      VALUES (
        ${data.accessToken},
        ${data.tokenType},
        ${data.expiresAt ? data.expiresAt : null},
        ${data.refreshedAt},
        ${data.userProfile ? JSON.stringify(data.userProfile) : null},
        NOW()
      )
      ON CONFLICT DO NOTHING
    `);

    // Keep only the latest token
    await db.execute(sql`
      DELETE FROM upstox_tokens
      WHERE id NOT IN (SELECT id FROM upstox_tokens ORDER BY updated_at DESC LIMIT 1)
    `);
  } catch {
    // DB failure — in-memory token still valid
  }
}

export async function loadToken(): Promise<UpstoxTokenData | null> {
  // Try in-memory first (fastest, avoids DB on every request)
  if (memoryToken) return memoryToken;

  try {
    await ensureTokenTable();
    const result = await db.execute(sql`
      SELECT access_token, token_type, expires_at, refreshed_at, user_profile
      FROM upstox_tokens
      ORDER BY updated_at DESC
      LIMIT 1
    `);

    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0] as Record<string, unknown>;
      const token: UpstoxTokenData = {
        accessToken: row.access_token as string,
        tokenType: (row.token_type as string) || "Bearer",
        expiresAt: row.expires_at ? String(row.expires_at) : null,
        refreshedAt: row.refreshed_at as string,
        userProfile: row.user_profile as Record<string, unknown> | undefined,
      };
      memoryToken = token;
      return token;
    }
  } catch {
    // DB not available
  }

  return null;
}

export async function clearToken(): Promise<void> {
  memoryToken = null;
  try {
    await ensureTokenTable();
    await db.execute(sql`DELETE FROM upstox_tokens`);
  } catch {
    // non-fatal
  }
}

export function isTokenExpired(token: UpstoxTokenData): boolean {
  if (!token.expiresAt) return false; // assume not expired if no expiry
  const expiry = new Date(token.expiresAt).getTime();
  const now = Date.now();
  return now >= expiry - 5 * 60 * 1000; // 5-minute buffer
}

export async function getValidToken(): Promise<string | null> {
  const token = await loadToken();
  if (!token) return null;
  if (isTokenExpired(token)) return null;
  return token.accessToken;
}

// ─── Safe Token Info (for client consumption — NO actual token) ───────────────

export interface SafeTokenInfo {
  connected: boolean;
  expiresAt: string | null;
  refreshedAt: string | null;
  expired: boolean;
}

export async function getSafeTokenInfo(): Promise<SafeTokenInfo> {
  const token = await loadToken();
  if (!token) {
    return { connected: false, expiresAt: null, refreshedAt: null, expired: false };
  }
  return {
    connected: true,
    expiresAt: token.expiresAt,
    refreshedAt: token.refreshedAt,
    expired: isTokenExpired(token),
  };
}
