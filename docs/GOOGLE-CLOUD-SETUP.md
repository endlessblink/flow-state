# Google Cloud Setup Guide

A step-by-step guide for self-hosters who want to enable Google sign-in, Google Calendar integration, and Google Drive attachments in FlowState.

## Overview

- **One Google Cloud project covers all three features** — sign-in, calendar, and drive share the same OAuth client
- **All three features are optional** — FlowState works fully with email/password auth
- **No billing account required** — the free tier covers normal personal/small-team usage
- **Credentials stay server-side** — Google Client ID and Secret live in Supabase environment variables, never in the browser

## What Each Feature Does

| Feature | What You Get | Required Scope |
|---------|-------------|----------------|
| Google Sign-In | "Sign in with Google" button on the login screen | `openid`, `email`, `profile` |
| Google Calendar | Your Google Calendar events appear in the Calendar view alongside FlowState tasks | `calendar.readonly` |
| Google Drive | Attach images to tasks; files are stored in your Google Drive under a FlowState folder | `drive.file` |

---

## Step 1: Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click the project dropdown at the top → **New Project**
3. Name it something recognizable, e.g. `FlowState` or `FlowState Self-Host`
4. Click **Create** and wait a few seconds for it to provision
5. Make sure the new project is selected in the dropdown before continuing

---

## Step 2: Enable APIs

1. In the left sidebar, go to **APIs & Services → Library**
2. Search for and enable each of the following:

   - **Google Calendar API** — required for Calendar integration
   - **Google Drive API** — required for Drive attachments

   For each: click the result → click **Enable**. Google Sign-In does not require a separate API — it uses OAuth2 which is always available.

---

## Step 3: Configure the OAuth Consent Screen

This screen is what users see when they authorize FlowState to access their Google account.

1. Go to **APIs & Services → OAuth consent screen**
2. **User Type**: Select **External** (required for apps outside your organization)
3. Click **Create**

### App Information

Fill in the required fields:

- **App name**: `FlowState` (or your preferred name — this is what users see)
- **User support email**: your email address
- **Developer contact information**: your email address

Click **Save and Continue**.

### Scopes

Click **Add or Remove Scopes** and add the following:

| Scope | Purpose |
|-------|---------|
| `.../auth/userinfo.email` | Google Sign-In — read user email |
| `.../auth/userinfo.profile` | Google Sign-In — read user name and avatar |
| `openid` | Google Sign-In — standard OIDC |
| `.../auth/calendar.readonly` | Calendar — read-only access to events |
| `.../auth/drive.file` | Drive — access only files FlowState creates |

Click **Update**, then **Save and Continue**.

### Test Users

While your app is in **Testing** mode (which it will be by default), only explicitly listed users can authorize it. You can have up to 100 test users.

1. Click **Add Users**
2. Add your own Google account and any others who will use this self-hosted instance
3. Click **Save and Continue**

> **Note on verification**: If you ever want more than 100 users, Google requires an app verification process. For personal or small-team self-hosting, Testing mode with up to 100 users is sufficient — you do not need to go through verification.

Click **Back to Dashboard** when done.

---

## Step 4: Create OAuth Credentials

1. Go to **APIs & Services → Credentials**
2. Click **+ Create Credentials → OAuth client ID**
3. **Application type**: Select **Web application**
4. **Name**: e.g. `FlowState Web`

### Authorized JavaScript Origins

Add all origins where FlowState will be served:

```
https://your-domain.com
http://localhost:5546
http://localhost:3000
http://127.0.0.1:5546
```

Replace `your-domain.com` with your actual domain. The localhost entries are needed for local development.

### Authorized Redirect URIs

These must match exactly — any mismatch causes a `redirect_uri_mismatch` error.

```
# Supabase GoTrue OAuth callback (required for all Google auth flows):
https://your-supabase-url/auth/v1/callback

# Local Supabase CLI (for development with supabase start):
http://127.0.0.1:54321/auth/v1/callback

# Tauri desktop app (uses a local loopback server, three ports for reliability):
http://127.0.0.1:24892
http://127.0.0.1:24893
http://127.0.0.1:24894
```

Replace `your-supabase-url` with your self-hosted Supabase URL (e.g. `https://supabase.your-domain.com`).

5. Click **Create**
6. A dialog appears with your **Client ID** and **Client Secret** — copy both now. You can always retrieve them later from the Credentials page.

---

## Step 5: Configure Supabase

Choose the path that matches your setup:

### Docker Self-Hosting (`.env.self-host` / `docker-compose`)

Add these to your Supabase environment file:

```env
SUPABASE_AUTH_EXTERNAL_GOOGLE_ENABLED=true
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=your-client-secret
SUPABASE_AUTH_EXTERNAL_GOOGLE_REDIRECT_URI=https://your-supabase-url/auth/v1/callback
```

Restart the auth service to pick up the changes:

```bash
docker compose -f docker-compose.self-host.yml restart auth
```

### Supabase CLI (Local Development)

The `supabase/config.toml` in this project reads from environment variables. Export them before running `supabase start`:

```bash
export SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
export SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=your-client-secret
```

Or add them to `.env.local` (never commit this file):

```env
SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET=your-client-secret
```

### Supabase Cloud (Managed)

1. Go to your Supabase project dashboard
2. Navigate to **Authentication → Providers**
3. Find **Google** in the list and click to expand
4. Toggle **Enable Sign in with Google**
5. Paste your **Client ID** and **Client Secret**
6. The Redirect URL shown on screen is your callback URI — confirm it matches what you added in Step 4
7. Click **Save**

---

## Step 6: Deploy Edge Functions

The Calendar and Drive features route API calls through Supabase Edge Functions so your Google credentials never reach the browser.

```bash
# Deploy the proxy functions (run from the project root):
supabase functions deploy google-calendar-proxy
supabase functions deploy google-drive-proxy
```

If you are deploying to a self-hosted Supabase instance, add `--project-ref your-project-ref` or configure your `supabase` CLI to point at the correct project.

---

## Step 7: Set Edge Function Secrets

The proxy functions need to know which origins are allowed to call them (CORS protection):

```bash
supabase secrets set ALLOWED_ORIGINS=https://your-domain.com,http://localhost:5546
```

Add every origin where FlowState is served, comma-separated. For local development, include `http://localhost:5546` and `http://127.0.0.1:5546`.

Verify the secret was set:

```bash
supabase secrets list
```

---

## Troubleshooting

### `redirect_uri_mismatch`

Google is rejecting the callback URI Supabase is sending.

- Open **APIs & Services → Credentials** in Google Cloud Console
- Click your OAuth client to edit it
- Compare the **Authorized redirect URIs** exactly against your Supabase URL
- Common issues: trailing slash, `http` vs `https`, wrong port, missing `/auth/v1/callback` suffix
- Changes can take a few minutes to propagate

### `access_denied`

The user is not in the test users list.

- Go to **OAuth consent screen → Test users**
- Add the Google account that is trying to sign in
- This only applies while the app is in Testing mode

### Calendar or Drive features not working after sign-in

The user signed in before these scopes were added, so their existing session does not include them.

- The user needs to disconnect Google from FlowState and reconnect
- In Settings, look for the connected accounts section → disconnect Google → sign in again
- On the new sign-in, Google will present the consent screen with the additional scopes

### CORS errors on Drive uploads

The Edge Function is rejecting the request origin.

- Check that `ALLOWED_ORIGINS` includes the exact origin the browser is using (check the `Origin` header in DevTools)
- Re-run `supabase secrets set ALLOWED_ORIGINS=...` with the correct value
- Edge Functions pick up new secrets on the next invocation — no redeploy needed

### Edge functions returning 401

The user's Supabase session token may have expired or the function cannot validate it.

- Have the user sign out and back in to get a fresh token
- Confirm the Edge Functions are deployed to the same Supabase project as the one serving the app

---

## Security Notes

- **Google credentials never reach the browser.** The Client ID and Secret are stored as Supabase server-side environment variables and only used by the GoTrue auth service and Edge Functions.
- **`drive.file` scope is limited by design.** FlowState can only access files it created — it cannot read, list, or modify any other files in the user's Google Drive.
- **`calendar.readonly` is read-only.** FlowState displays calendar events but cannot create, edit, or delete them.
- **Supabase handles token storage.** OAuth refresh tokens are stored in Supabase's auth schema, not in the browser or in FlowState's application database.
- **Test mode limits exposure.** Keeping the app in Testing mode (up to 100 users) means unverified third parties cannot authorize it — appropriate for personal or team self-hosting.
