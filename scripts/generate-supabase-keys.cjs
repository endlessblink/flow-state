#!/usr/bin/env node
/**
 * Generates valid JWT keys for local Supabase development.
 *
 * These keys are signed with the default local Supabase JWT secret.
 * Copy the output to your .env.local file.
 *
 * Usage: npm run generate:keys
 */
const crypto = require('crypto');

// Local Supabase default JWT secret
const SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';

// Token expiry (year 2032)
const EXP = 1983339124;

/**
 * Generates a HS256 signed JWT
 */
function generateJWT(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
}

const anonKey = generateJWT({
  iss: 'supabase-demo',
  role: 'anon',
  exp: EXP
});

const serviceRoleKey = generateJWT({
  iss: 'supabase-demo',
  role: 'service_role',
  exp: EXP
});

console.log('');
console.log('\x1b[36mGenerated Supabase JWT keys for local development:\x1b[0m');
console.log('');
console.log('\x1b[33mCopy these to your .env.local file:\x1b[0m');
console.log('');
console.log(`VITE_SUPABASE_ANON_KEY=${anonKey}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`);
console.log('');
console.log('\x1b[32mThese keys expire in 2032 and are signed with the default local Supabase secret.\x1b[0m');
console.log('');
