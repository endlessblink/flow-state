#!/usr/bin/env node
/**
 * Validates local Supabase JWT keys before starting the dev server.
 * Catches key/secret mismatches early to avoid cryptic WebSocket 403 errors.
 *
 * Only runs for local development (127.0.0.1 or localhost URLs).
 */
const crypto = require('crypto');
const path = require('path');

// Local Supabase default JWT secret
const LOCAL_JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';

/**
 * Validates a JWT signature against a secret
 */
function validateJWT(token, secret) {
  if (!token || typeof token !== 'string') return false;

  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [header, payload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64url');

  return signature === expectedSig;
}

/**
 * Decodes JWT payload (without verification)
 */
function decodePayload(token) {
  try {
    const [, payload] = token.split('.');
    return JSON.parse(Buffer.from(payload, 'base64url').toString());
  } catch {
    return null;
  }
}

// Load .env.local
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseUrl = process.env.VITE_SUPABASE_URL;

// Only validate for local development
const isLocalDev = supabaseUrl?.includes('127.0.0.1') || supabaseUrl?.includes('localhost');

if (isLocalDev) {
  console.log('\x1b[36m[Supabase] Validating local JWT keys...\x1b[0m');

  if (!anonKey) {
    console.error('\x1b[31m[Supabase] Missing VITE_SUPABASE_ANON_KEY in .env.local\x1b[0m');
    console.error('\x1b[33mRun: npm run generate:keys\x1b[0m');
    process.exit(1);
  }

  if (!validateJWT(anonKey, LOCAL_JWT_SECRET)) {
    const payload = decodePayload(anonKey);
    console.error('\x1b[31m[Supabase] JWT signature mismatch!\x1b[0m');
    console.error('');
    console.error('The VITE_SUPABASE_ANON_KEY in .env.local was signed with a different secret');
    console.error('than what your local Supabase instance is using.');
    console.error('');
    if (payload) {
      console.error(`  Current key claims: iss=${payload.iss}, role=${payload.role}`);
    }
    console.error('');
    console.error('\x1b[33mTo fix, run: npm run generate:keys\x1b[0m');
    console.error('Then copy the output to your .env.local file.');
    console.error('');
    process.exit(1);
  }

  console.log('\x1b[32m[Supabase] JWT keys validated successfully\x1b[0m');
} else if (supabaseUrl) {
  console.log('\x1b[36m[Supabase] Remote URL detected, skipping local key validation\x1b[0m');
}
