/**
 * Local authentication (offline-first).
 *
 * Replaces the dead remote auth service. Accounts and the active session live
 * in localStorage. Passwords are stored as salted SHA-256 hashes, never in
 * plain text. A default account is created on first boot.
 */

export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Session {
  access_token: string;
  user: User;
  expires_at: number;
}

export interface AuthError {
  message: string;
}

interface StoredAccount extends User {
  salt: string;
  password_hash: string;
}

const USERS_KEY = "bisnisku:users:v1";
const SESSION_KEY = "bisnisku:session:v1";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

export const DEFAULT_EMAIL = "admin@cetakfotodibali.com";
export const DEFAULT_PASSWORD = "admin123";

const memoryStore = new Map<string, string>();

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memoryStore.get(key) ?? null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    memoryStore.set(key, value);
  }
}

function safeRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    memoryStore.delete(key);
  }
}

/* -------------------------------------------------------------------------- */
/* Password hashing                                                            */
/* -------------------------------------------------------------------------- */

function randomHex(bytes: number): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time-ish comparison to avoid leaking hash prefixes. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* -------------------------------------------------------------------------- */
/* Accounts                                                                    */
/* -------------------------------------------------------------------------- */

function readAccounts(): StoredAccount[] {
  const raw = safeGet(USERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredAccount[]) : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: StoredAccount[]): void {
  safeSet(USERS_KEY, JSON.stringify(accounts));
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toPublicUser(account: StoredAccount): User {
  return { id: account.id, email: account.email, created_at: account.created_at };
}

async function createAccount(email: string, password: string): Promise<StoredAccount> {
  const salt = randomHex(16);
  return {
    id: crypto.randomUUID(),
    email: normalizeEmail(email),
    created_at: new Date().toISOString(),
    salt,
    password_hash: await hashPassword(password, salt),
  };
}

/** Ensures the default account exists so the app is never locked out. */
export async function initLocalAuth(): Promise<void> {
  if (readAccounts().length > 0) return;
  writeAccounts([await createAccount(DEFAULT_EMAIL, DEFAULT_PASSWORD)]);
}

/* -------------------------------------------------------------------------- */
/* Session                                                                     */
/* -------------------------------------------------------------------------- */

function readSession(): Session | null {
  const raw = safeGet(SESSION_KEY);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Session;
    if (!session?.user?.id || session.expires_at < Date.now()) {
      safeRemove(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

function writeSession(user: User): Session {
  const session: Session = {
    access_token: randomHex(24),
    user,
    expires_at: Date.now() + SESSION_TTL_MS,
  };
  safeSet(SESSION_KEY, JSON.stringify(session));
  return session;
}

type AuthEvent = "INITIAL_SESSION" | "SIGNED_IN" | "SIGNED_OUT";
type AuthListener = (event: AuthEvent, session: Session | null) => void;

const listeners = new Set<AuthListener>();

function emit(event: AuthEvent, session: Session | null): void {
  for (const listener of listeners) listener(event, session);
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

export const localAuth = {
  async getSession(): Promise<{ data: { session: Session | null }; error: AuthError | null }> {
    return { data: { session: readSession() }, error: null };
  },

  async getUser(): Promise<{ data: { user: User | null }; error: AuthError | null }> {
    return { data: { user: readSession()?.user ?? null }, error: null };
  },

  async signUp({
    email,
    password,
  }: {
    email: string;
    password: string;
  }): Promise<{ data: { user: User | null; session: Session | null }; error: AuthError | null }> {
    const normalized = normalizeEmail(email);
    if (!normalized) return { data: { user: null, session: null }, error: { message: "Email wajib diisi." } };
    if (password.length < 6) {
      return { data: { user: null, session: null }, error: { message: "Password minimal 6 karakter." } };
    }

    const accounts = readAccounts();
    if (accounts.some((a) => a.email === normalized)) {
      return { data: { user: null, session: null }, error: { message: "Email sudah terdaftar." } };
    }

    const account = await createAccount(normalized, password);
    writeAccounts([...accounts, account]);

    const user = toPublicUser(account);
    const session = writeSession(user);
    emit("SIGNED_IN", session);
    return { data: { user, session }, error: null };
  },

  async signInWithPassword({
    email,
    password,
  }: {
    email: string;
    password: string;
  }): Promise<{ data: { user: User | null; session: Session | null }; error: AuthError | null }> {
    const normalized = normalizeEmail(email);
    const account = readAccounts().find((a) => a.email === normalized);
    const failure = { data: { user: null, session: null }, error: { message: "Email atau password salah." } };
    if (!account) return failure;

    const hash = await hashPassword(password, account.salt);
    if (!safeEqual(hash, account.password_hash)) return failure;

    const user = toPublicUser(account);
    const session = writeSession(user);
    emit("SIGNED_IN", session);
    return { data: { user, session }, error: null };
  },

  async updatePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ error: AuthError | null }> {
    const session = readSession();
    if (!session) return { error: { message: "Sesi tidak ditemukan, silakan login ulang." } };
    if (newPassword.length < 6) return { error: { message: "Password baru minimal 6 karakter." } };

    const accounts = readAccounts();
    const index = accounts.findIndex((a) => a.id === session.user.id);
    if (index === -1) return { error: { message: "Akun tidak ditemukan." } };

    const account = accounts[index];
    const currentHash = await hashPassword(currentPassword, account.salt);
    if (!safeEqual(currentHash, account.password_hash)) return { error: { message: "Password saat ini salah." } };

    const salt = randomHex(16);
    accounts[index] = { ...account, salt, password_hash: await hashPassword(newPassword, salt) };
    writeAccounts(accounts);
    return { error: null };
  },

  async signOut(): Promise<{ error: AuthError | null }> {
    safeRemove(SESSION_KEY);
    emit("SIGNED_OUT", null);
    return { error: null };
  },

  onAuthStateChange(callback: AuthListener): { data: { subscription: { unsubscribe: () => void } } } {
    listeners.add(callback);
    return {
      data: {
        subscription: {
          unsubscribe: () => {
            listeners.delete(callback);
          },
        },
      },
    };
  },
};
