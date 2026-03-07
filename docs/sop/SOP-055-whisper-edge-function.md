# SOP-036: Whisper Voice Transcription via Supabase Edge Function

**Created**: 2026-01-25
**Related Task**: BUG-1070
**Status**: Active

## Problem

PWA voice input wasn't showing because the original implementation required a client-side GROQ API key. This exposed secrets in the browser and made deployment complex (each client needed the key).

## Solution

Refactored to use a Supabase Edge Function that:
1. Receives audio blob from client
2. Calls GROQ Whisper API server-side
3. Returns transcription

This pattern:
- Keeps API keys server-side (secure)
- Simplifies client code (no key management)
- Works with any deployment (VPS, Supabase hosted, local)

## Architecture

```
Client (Vue) → Edge Function → GROQ Whisper API
    ↓                ↓
Audio Blob      GROQ_API_KEY (env var)
                     ↓
              Transcription JSON
```

## Key Files

| File | Purpose |
|------|---------|
| `supabase/functions/whisper-transcribe/index.ts` | Edge function that calls GROQ |
| `src/composables/useWhisperSpeech.ts` | Client-side audio handling + edge function calls |
| `src/composables/useVoiceInput.ts` | High-level voice input orchestration |

## Deployment

### VPS (Self-hosted Supabase)

1. **Deploy Edge Function**:
   ```bash
   # Edge functions are served by Supabase Edge Runtime
   cd /opt/supabase/docker
   docker-compose restart supabase-edge-functions
   ```

2. **Configure GROQ API Key**:
   - Add `GROQ_API_KEY` to Doppler (`flowstate-prod` project)
   - Sync to VPS: `doppler secrets download --no-file --format env-no-quotes > /opt/supabase/.env.local`
   - Restart edge runtime

3. **Verify**:
   ```bash
   curl -X POST https://api.in-theflow.com/functions/v1/whisper-transcribe \
     -H "Content-Type: application/json" \
     -d '{"audio_base64": "..."}'
   ```

### Local Development

1. Start Supabase: `npx supabase start`
2. Set GROQ_API_KEY in `.env.local`
3. Edge functions auto-serve at `http://localhost:54321/functions/v1/whisper-transcribe`

## Client Usage

```typescript
import { useWhisperSpeech } from '@/composables/useWhisperSpeech'

const { transcribe, isTranscribing, error } = useWhisperSpeech()

// Audio blob from MediaRecorder
const transcription = await transcribe(audioBlob)
```

## Troubleshooting

### Voice button not showing

1. Check browser support: `navigator.mediaDevices.getUserMedia`
2. Check console for errors
3. Verify edge function is deployed and accessible

### Transcription fails

1. Check GROQ_API_KEY is set in edge runtime
2. Check edge function logs: `docker logs supabase-edge-functions`
3. Verify CORS headers allow your domain

### Audio quality issues

- Use `audio/webm; codecs=opus` format (best quality/size ratio)
- Ensure sample rate is 16000Hz or higher
- Keep recordings under 25MB (GROQ limit)

## Related SOPs

- [SOP-030: Doppler Secrets Management](SOP-030-doppler-secrets-management.md) - How to manage GROQ_API_KEY
- [SOP-026: Custom Domain Deployment](SOP-026-custom-domain-deployment.md) - VPS setup for edge functions
