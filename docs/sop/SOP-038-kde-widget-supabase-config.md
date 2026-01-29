# SOP-038: KDE Widget Supabase Configuration

**Created**: 2026-01-29
**Related Task**: TASK-1009
**Status**: Active

## Problem

KDE Plasma widget (PomoFlow) shows "Invalid authentication credentials" error when signing in, despite correct email/password.

## Root Cause

The widget stores Supabase configuration in `~/.config/plasma-org.kde.plasma.desktop-appletsrc`. If the `supabaseAnonKey` doesn't match the server's JWT secret, all auth requests fail with 400 Invalid Credentials.

Common scenarios:
1. Widget configured with demo/local key, server uses production key
2. Server JWT secret changed but widget key wasn't updated
3. Copy-paste error when entering the anon key

## Diagnosis

### Step 1: Check Current Widget Config

```bash
grep -A 5 "plugin=com.pomoflow.widget" ~/.config/plasma-org.kde.plasma.desktop-appletsrc | grep supabase
```

### Step 2: Compare Keys

**Production key** (from `.env.local` or Doppler):
```bash
grep VITE_SUPABASE_ANON_KEY .env.local
```

**Widget key** (from config):
```bash
grep supabaseAnonKey ~/.config/plasma-org.kde.plasma.desktop-appletsrc
```

If they don't match, that's the problem.

### Step 3: Test Auth Endpoint Directly

```bash
curl -s -X POST "https://api.in-theflow.com/auth/v1/token?grant_type=password" \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_ANON_KEY_HERE" \
  -d '{"email":"test@example.com","password":"test"}' | jq .
```

If you get `{"code":400,"error_code":"invalid_credentials","msg":"Invalid login credentials"}`, the key is correct (just wrong password). If you get a different error, the key is wrong.

## Solution

### Option A: Via Widget Config UI (Recommended)

1. Right-click the PomoFlow widget
2. Select "Configure PomoFlow"
3. Go to "Supabase Connection" section
4. Update:
   - **Project URL**: `https://api.in-theflow.com` (or your Supabase URL)
   - **Anon Key**: Paste the correct JWT key from `.env.local`
5. Click Apply
6. Try signing in again

### Option B: Direct Config Edit

```bash
# Replace the old key with the correct one
sed -i 's|supabaseAnonKey=OLD_KEY_HERE|supabaseAnonKey=CORRECT_KEY_HERE|g' \
  ~/.config/plasma-org.kde.plasma.desktop-appletsrc

# Restart plasmashell to apply
plasmashell --replace &
```

### Option C: Full Reset

If config is corrupted, remove and re-add the widget:

1. Right-click widget → Remove
2. Right-click panel → Add Widgets → Search "PomoFlow"
3. Configure with correct Supabase URL and key

## Key Files

| File | Purpose |
|------|---------|
| `~/.config/plasma-org.kde.plasma.desktop-appletsrc` | KDE widget configurations |
| `~/.local/share/plasma/plasmoids/com.pomoflow.widget/contents/ui/main.qml` | Widget source code |
| `~/.local/share/plasma/plasmoids/com.pomoflow.widget/contents/config/main.xml` | Widget config schema |

## Verification

After fixing:

1. Widget shows "Signed in" status (green dot)
2. Timer syncs with web app
3. Tasks appear in widget task list
4. Starting timer on widget reflects on web app (and vice versa)

## Prevention

When changing Supabase JWT keys (see SOP-036):
1. Update `.env.local` for web app
2. Update Doppler for CI/CD
3. Update KDE widget config manually (not in git)
