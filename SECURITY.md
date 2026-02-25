# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT open a public issue**
2. Use [GitHub's private vulnerability reporting](../../security/advisories/new)
3. Include: description, reproduction steps, impact assessment

We will acknowledge within 48 hours and provide a fix timeline within 7 days.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest  | Yes       |
| < Latest | No — please upgrade |

## Security Best Practices for Self-Hosters

- Never expose Supabase service role key publicly
- Rotate VAPID keys periodically
- Keep your `.env` files out of version control
- Use HTTPS in production (Caddy handles this automatically)
- Set `ALLOWED_ORIGINS` on Edge Functions to your domain only
