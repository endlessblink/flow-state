# SOP-057: Google Drive Attachments Setup

## Overview

FlowState supports attaching images to tasks, stored in Google Drive. This keeps VPS disk usage at zero for attachments—all image files are stored in the user's Google Drive account within an auto-created `FlowState/` folder.

**Key Benefits:**
- **Zero VPS storage cost** — images are not stored on your infrastructure
- **User-owned storage** — files live in the user's Google Drive, fully under their control
- **Scope-limited access** — the app only accesses files it creates (`drive.file` scope, not `drive`)
- **Secure proxy pattern** — OAuth tokens never touch client bundle, refreshed server-side via Edge Function

**Supported Operations:**
- Upload images to Google Drive (with client-side compression)
- Delete images from Google Drive
- Display thumbnails inline in task editor

## Prerequisites

- **Google OAuth already configured** for FlowState (used for Calendar integration)
- **Supabase self-hosted** with Edge Functions deployed
- **Google Cloud Console access** to enable APIs and configure scopes

## Self-Hosted Setup Steps

### Step 1: Enable Google Drive API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select the **same project** used for Supabase Google OAuth configuration (see CLAUDE.md or your deployment notes)
3. Navigate to **APIs & Services > Library**
4. Search for **"Google Drive API"**
5. Click **Enable** (or confirm it's already enabled)
6. Verify status: Go to **APIs & Services > Enabled APIs** — should see "Google Drive API v3"

### Step 2: Update OAuth Consent Screen

**Important:** Add the `drive.file` scope to your existing OAuth consent screen. This is required for Drive attachment access.

1. Go to **APIs & Services > OAuth consent screen**
2. Click **Edit App**
3. Navigate to the **Scopes** section
4. Click **Add or Remove Scopes**
5. Search for and add: `https://www.googleapis.com/auth/drive.file`
   - This is the most restrictive Drive scope — the app can ONLY access files it creates
   - **NOT** `https://www.googleapis.com/auth/drive` (which grants access to all user files)
6. Save the changes

**Result:** Next time users sign in, they'll see an updated Google consent screen asking for Drive file creation permission.

### Step 3: Verify Google OAuth Credentials

Confirm that your existing Google OAuth credentials are still valid:

```bash
# Check Doppler (or your secrets manager)
doppler secrets get SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID
doppler secrets get SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET

# Or check your .env file
grep GOOGLE_CLIENT_ID .env.local
grep GOOGLE_CLIENT_SECRET .env.local
```

**These credentials are used by both:**
- Google Calendar proxy (existing)
- Google Drive proxy (new)

No new credentials needed — the same client ID/secret handles both APIs.

### Step 4: Deploy Edge Function

Deploy the `google-drive-proxy` edge function to your Supabase instance:

```bash
# From project root
supabase functions deploy google-drive-proxy
```

**What this function does:**
- Accepts upload/download/delete/metadata requests from the client
- Validates Supabase JWT from Authorization header
- Refreshes expired Google OAuth tokens using your stored `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET`
- Communicates with Google Drive API on behalf of the user
- Never stores OAuth tokens — they're passed per-request from the client

**Verification:**
```bash
# Check function is deployed
supabase functions list

# Should output something like:
# Name                       Status    Endpoint
# google-drive-proxy         ready     /functions/v1/google-drive-proxy
```

### Step 5: Run Database Migration

Add the `attachments` JSONB column to the `tasks` table:

```bash
supabase db push
```

This applies the migration that adds:
- `attachments` JSONB column to store attachment metadata
- Default value: `[]` (empty array)

**Schema:**
```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS attachments jsonb DEFAULT '[]';
```

**Attachment object structure:**
```json
{
  "id": "uuid",              // Local unique ID
  "driveFileId": "string",   // Google Drive file ID
  "name": "string",          // Original filename
  "mimeType": "string",      // e.g., "image/jpeg"
  "thumbnailUrl": "string",  // Google Drive thumbnail URL (optional)
  "uploadedAt": "ISO date"   // Timestamp
}
```

### Step 6: Restart Services

Ensure your Supabase instance picks up the new function and migration:

```bash
# Stop existing services
supabase stop

# Start fresh
supabase start
```

Or if running via Docker/VPS:
```bash
# Restart Supabase containers
docker-compose restart

# Or (if manually deployed on VPS)
systemctl restart supabase
```

## How It Works

### Upload Flow

```
User drops image in task editor
         ↓
Client compresses image (OffscreenCanvas, max 1920px, JPEG 0.8)
         ↓
Client sends compressed base64 to edge function
         ↓
Edge function decodes base64 → multipart upload → Google Drive API
         ↓
Edge function creates "FlowState/" folder if missing
         ↓
Edge function sets "reader / anyone" permission on file (for thumbnails)
         ↓
Edge function returns fileId + thumbnailUrl to client
         ↓
Client stores attachment metadata in task.attachments[] JSONB
         ↓
Task is saved to Supabase with attachments
```

### Compression Specs

- **Max dimension:** 1920px (longer edge)
- **JPEG quality:** 0.8 (80% quality)
- **Max file size before compression:** 10MB
- **Output format:** Always JPEG (original PNG/WebP/GIF converted)

### Folder Structure in Google Drive

When a user uploads their first attachment, the app automatically creates:

```
Google Drive Root
└── FlowState/
    ├── image1.jpg
    ├── image2.jpg
    └── ...
```

This folder is created by the edge function on first upload. Users can access it from their Drive if needed.

## User Experience

### Initial Setup (First Time Login with This Feature)

1. User signs out completely
2. User signs in again
3. Updated Google consent screen appears:
   - "FlowState is requesting access to manage files you create in Google Drive"
4. User clicks "Allow"
5. Now able to upload images to tasks

### Uploading Images

1. Open a task in the editor
2. Scroll to "Attachments" section (in task modal)
3. Click **"Upload Image"** or drag-drop an image into the zone
4. Progress indicator shows: "Compressing..." → "Uploading..." → "Done"
5. Thumbnail appears inline
6. Image is now saved with the task

### Viewing & Deleting

- **View:** Thumbnail displays inline in task card or modal
- **Delete:** Click delete icon next to thumbnail → removes from task and Google Drive
- **Download:** Click image to open in Google Drive (opens in new tab)

### Limitations

- **No public sharing:** Attachments are only visible to the signed-in user (not shared with other FlowState users)
- **Storage quota:** Subject to user's Google Drive quota (15GB free, or more with paid Google One)
- **File types:** Images only (JPEG, PNG, WebP, GIF converted to JPEG)

## Troubleshooting

### Issue: "Connect Google account" message shown in task editor

**Symptom:** Attachments section shows "Please connect your Google account to upload images" even though user is already signed in.

**Root Cause:** User signed in before the `drive.file` scope was added to OAuth consent screen.

**Fix:**
1. Have user sign out completely: Settings > Sign Out
2. Sign back in
3. Accept the updated Google consent screen
4. Attachments section should now be active

### Issue: Upload fails with "403 Forbidden"

**Symptom:** User clicks upload, sees error: `Google Drive upload error: 403`

**Root Cause:** Google Drive API not enabled in Google Cloud Console.

**Fix:**
1. Go to Google Cloud Console → APIs & Services → Library
2. Search for "Google Drive API"
3. Click **Enable**
4. Wait 1-2 minutes for API to activate
5. Try upload again

### Issue: "drive.file scope not granted"

**Symptom:** Edge function returns `Error: User did not grant drive.file scope`

**Root Cause:** User's OAuth tokens don't have the `drive.file` scope.

**Fix:**
1. Add scope to OAuth consent screen (Step 2 above)
2. Have user sign out and back in
3. User must accept the new permissions
4. Try again

### Issue: "Token expired" / "Please reconnect your Google account"

**Symptom:** Upload fails after 1-2 hours of inactivity.

**Root Cause:** Google OAuth access token expired, and refresh token expired or was revoked.

**Fix:**
1. Go to Settings > Connected Accounts
2. Click "Reconnect Google" (if available)
3. Or: Sign out completely and sign back in

**Note:** The edge function automatically refreshes tokens if a refresh token is available. Only happens if refresh fails.

### Issue: "No FlowState folder in my Google Drive"

**Symptom:** User checks Google Drive and doesn't see the `FlowState/` folder.

**Root Cause:** No attachments have been uploaded yet (folder is created on first upload).

**Fix:** Upload an image to create the folder.

### Issue: Thumbnail not showing in task card

**Symptom:** Image was uploaded, but thumbnail doesn't display in task.

**Root Cause:** Google Drive thumbnail URL requires public read access. Edge function sets this automatically, but permission may not have applied.

**Fix:**
1. In Google Drive, right-click the file and select "Share"
2. Change "Restricted" to "Anyone with the link"
3. Role: "Viewer"
4. Save
5. Refresh task in FlowState — thumbnail should appear

### Issue: "SUPABASE_URL is not configured"

**Symptom:** Upload fails with `[GoogleDriveService] VITE_SUPABASE_URL is not configured`

**Root Cause:** Environment variable not set during build.

**Fix:**
1. Ensure `.env.local` has `VITE_SUPABASE_URL` set
2. Run `npm run dev` to verify it loads
3. If using production build, check `.env.production` — should inherit from `.env.local` or CI env vars
4. Rebuild: `npm run build`

## Configuration Reference

### Environment Variables

**Required** (same as for Calendar integration):

| Variable | Purpose |
|----------|---------|
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` | OAuth client ID (Doppler or .env) |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` | OAuth client secret (Doppler or .env) |
| `VITE_SUPABASE_URL` | Supabase instance URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous public key |

### Edge Function Environment

The `google-drive-proxy` function automatically reads:
- `SUPABASE_URL` — Supabase instance (set by platform)
- `SUPABASE_ANON_KEY` — Public anonymous key (set by platform)
- `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` — From Doppler secrets
- `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` — From Doppler secrets

**Verify secrets are set:**
```bash
# From Supabase dashboard
supabase secrets list

# Or from Doppler
doppler secrets get SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID
```

### Database Schema

**Migration adds:**
```sql
ALTER TABLE public.tasks
ADD COLUMN attachments jsonb DEFAULT '[]';

COMMENT ON COLUMN public.tasks.attachments IS
  'Array of {id, driveFileId, name, mimeType, thumbnailUrl, uploadedAt} objects';
```

**RLS policy:** Same as parent task (inherited).

## Architecture & Security

### Token Flow (OAuth Security)

```
User Browser                Edge Function              Google API
    ↓                              ↓                         ↓
    └─ Upload request ─→ Function checks JWT
                         Validates Supabase auth
                         ↓
                    Receives googleToken + googleRefreshToken
                         ↓
                    Sends to Google Drive API ──→ Upload file
                         ↓
                    If 401: Refresh token ──→ Get new access token
                         ↓
                    Return fileId to client
    ←─ Response ──────────────────
```

**Key Security Properties:**
- Client never touches Google API directly (proxied via Edge Function)
- OAuth tokens never stored on VPS (only in user's Supabase session)
- Tokens passed per-request, never persisted in function
- Token refresh uses SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET (not exposed to client)
- All requests validated with Supabase JWT

### File Access Control

- **User isolation:** Each user's attachments are stored in their own Google Drive
- **File scope:** `drive.file` scope = app can only access files **it created** (not all user files)
- **Permissions:** Edge function sets "reader / anyone" on files for thumbnail URLs
  - This is required for `<img src="...">` to work
  - Does NOT make files discoverable — URLs are unguessable (long random IDs)

### Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Token theft | Tokens passed in request body over HTTPS; never in URL. Refresh handled server-side. |
| Unauthorized drive access | `drive.file` scope limits to files created by app; no access to user's personal files. |
| File enumeration | Google Drive file IDs are cryptographically random; files not listed in public Drive. |
| Storage quota abuse | User's quota applies; they control what's uploaded. |
| Stale thumbnails | Cloud-hosted by Google; always fresh URLs. |

## Related Documentation

- **FEATURE-1414** — Task Image Attachments via Google Drive (MASTER_PLAN.md)
- **SOP-030** — [Doppler Secrets Management](./SOP-030-doppler-secrets-management.md) — Environment variable setup
- **SOP-031** — [CORS Configuration](./SOP-031-cors-configuration.md) — If issues with cross-origin requests
- **SOP-026** — [Custom Domain Deployment](./SOP-026-custom-domain-deployment.md) — VPS domain setup
- **Code Reference:**
  - `supabase/functions/google-drive-proxy/index.ts` — Edge function implementation
  - `src/services/drive/googleDriveService.ts` — Client service
  - `src/components/tasks/TaskAttachments.vue` — Upload UI component (coming soon)
  - `supabase/migrations/20260223000000_add_task_attachments.sql` — Database migration

## Version Support

| Feature | Version |
|---------|---------|
| Google Drive Attachments | v1.2.92+ |
| Required Supabase | v0.30+  |
| Required Google API | Drive API v3 |

## Change Log

| Date | Change |
|------|--------|
| 2026-02-23 | Initial SOP created; feature implemented with edge function, client service, and migration. |

---

**Last Updated:** 2026-02-23
**Status:** Active
**Maintainer:** FlowState Team
