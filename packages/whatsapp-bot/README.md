# PomoFlow WhatsApp Bot

## Overview

Send or forward any WhatsApp message and it appears as a task in FlowState's inbox. Two approaches — pick one:

| | **Bot (AI-powered)** | **Edge Function (simple)** |
|---|---|---|
| AI parsing | Groq Llama 3.3 70B | None |
| Task fields | Title, priority, due date, duration | Title from first line |
| Media support | Text messages only | Photos, videos, audio, documents |
| Confirmation reply | Yes | No |
| Deduplication | None | Yes (by WAHA message ID) |
| Runs on | Your machine (Docker) | Supabase (serverless) |

---

## How It Works

**Bot approach:**
```
WhatsApp message
  → WAHA container (port 3000)
  → POST /webhook/waha (bot, port 3001)
  → Groq AI parses text into structured task
  → Supabase insert (inbox)
  → Confirmation reply via WAHA
```

**Edge Function approach:**
```
WhatsApp message
  → WAHA container
  → POST /functions/v1/whatsapp-task-webhook (Supabase Edge)
  → Raw text/media label becomes task title
  → Supabase insert (inbox, tagged "whatsapp")
```

---

## Prerequisites

- Docker and Docker Compose
- A spare WhatsApp number (or your personal number)
- For the AI bot: a free [Groq API key](https://console.groq.com)
- Your FlowState Supabase URL and service role key

---

## Quick Start (Docker — AI Bot)

```bash
cd packages/whatsapp-bot
cp .env.example .env
# Edit .env with your values (see Environment Variables below)
docker compose up -d
```

Then:
1. Open `http://localhost:3000` (WAHA dashboard)
2. Go to **Sessions** and scan the QR code with WhatsApp on your phone
3. Send a message to the connected number — it appears in FlowState's inbox within seconds

Health check: `curl http://localhost:3001/health`

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `WAHA_URL` | Yes | `http://localhost:3000` | WAHA container URL (internal: `http://waha:3000`) |
| `WAHA_API_KEY` | No | — | WAHA API key if you set one in WAHA config |
| `GROQ_API_KEY` | Yes | — | Groq API key for AI parsing |
| `GROQ_MODEL` | No | `llama-3.3-70b-versatile` | Groq model to use |
| `SUPABASE_URL` | Yes | — | Your FlowState Supabase instance URL |
| `SUPABASE_SERVICE_KEY` | Yes | — | Supabase service role key (bypasses RLS) |
| `ALLOWED_CHAT_IDS` | Yes | — | Comma-separated WhatsApp chat IDs to accept |
| `DEFAULT_USER_ID` | Yes | — | Your Supabase user UUID |
| `BOT_PORT` | No | `3001` | Port for the bot webhook server |

---

## Finding Your Chat ID

Chat IDs are not the same as phone numbers. To find yours:

1. Start the stack: `docker compose up -d`
2. Send any message to the WAHA-connected number
3. Check bot logs: `docker compose logs bot`
4. Look for a line like: `[BOT] Rejected message from unlisted chat: 15551234567@c.us`
5. Copy that ID into `ALLOWED_CHAT_IDS` in your `.env` and restart: `docker compose restart bot`

Format: `{countrycode}{number}@c.us` — e.g. `15551234567@c.us` for a US number.

---

## Alternative: Edge Function (No AI)

If you prefer a serverless, no-AI approach that also handles media messages:

**1. Deploy the Edge Function:**
```bash
supabase functions deploy whatsapp-task-webhook
supabase secrets set WAHA_WEBHOOK_SECRET=your-random-secret
supabase secrets set FLOWSTATE_USER_ID=your-supabase-user-uuid
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**2. Configure WAHA to POST webhooks to:**
```
https://your-supabase-url/functions/v1/whatsapp-task-webhook?secret=your-random-secret
```

Set `WHATSAPP_HOOK_URL` to the above URL in your WAHA environment (the `?secret=` query param is required because WAHA CORE does not reliably forward custom headers).

**What it does differently:**
- No Groq API key needed
- Accepts both sent and received messages (useful for forwarding to yourself)
- Handles media: photos get "📷 Photo", videos get "🎥 Video", etc.
- Built-in dedup — identical WAHA message IDs are silently skipped
- Tasks tagged `whatsapp` automatically
- No reply sent back to WhatsApp

---

## Security

- `ALLOWED_CHAT_IDS` (bot) prevents strangers from creating tasks in your inbox
- `WAHA_WEBHOOK_SECRET` (Edge Function) authenticates the webhook — WAHA and your function share a secret
- `SUPABASE_SERVICE_KEY` is only used server-side inside Docker or the Edge Function runtime, never exposed to clients

---

## Troubleshooting

**No tasks appearing in FlowState**
- Check `ALLOWED_CHAT_IDS` — the value must exactly match the sender ID in logs
- Verify `DEFAULT_USER_ID` is a valid UUID from your Supabase `auth.users` table

**AI parsing not working**
- Check `docker compose logs bot` for Groq errors
- Verify `GROQ_API_KEY` is valid at [console.groq.com](https://console.groq.com)

**Can't scan QR code / WhatsApp disconnected**
- Restart WAHA: `docker compose restart waha`
- If the session is stuck, delete it in the WAHA dashboard and re-scan

**Edge Function returns 401**
- Confirm the `?secret=` query param in `WHATSAPP_HOOK_URL` matches `WAHA_WEBHOOK_SECRET`
- Supabase secret names are case-sensitive
