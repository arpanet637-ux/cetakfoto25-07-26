/**
 * Compatibility client.
 *
 * The previous remote backend (Cloudflare D1 / GetMocha) is gone, and calling
 * `createClient()` without env vars threw at module load - which is what turned
 * the deployed site into a blank screen.
 *
 * This module now exposes the same `supabase`-shaped API backed entirely by
 * localStorage, so no call site had to change.
 */

import { localDb } from "./local-db";
import { localAuth } from "./local-auth";

export type { User, Session, AuthError } from "./local-auth";
export { initLocalDb, exportDatabase, replaceDatabase, resetDatabase } from "./local-db";
export { initLocalAuth, DEFAULT_EMAIL, DEFAULT_PASSWORD } from "./local-auth";

export const supabase = {
  from: localDb.from,
  storage: localDb.storage,
  auth: localAuth,
};
