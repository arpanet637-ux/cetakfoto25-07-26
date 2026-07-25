/// <reference types="@cloudflare/workers-types" />

interface Env {
  DB: D1Database;
  R2_BUCKET: R2Bucket;
  EMAILS: Fetcher;
  MOCHA_USERS_SERVICE_API_URL: string;
  MOCHA_USERS_SERVICE_API_KEY: string;
}
