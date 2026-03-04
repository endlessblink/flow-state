import type { ParsedTask, ParseResult } from './types.js'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

const SYSTEM_PROMPT = `You are a task extraction assistant for a personal productivity app.
Given a WhatsApp message (forwarded or direct), extract a task.

Rules:
- Extract a clear, actionable task title (5-15 words max)
- Detect priority: "urgent"/"ASAP"/"critical"/"דחוף"/"חשוב מאוד" → high, "when you can"/"sometime"/"כשתספיק" → low, else medium
- Detect due dates relative to today ({{TODAY}}):
  - "tomorrow"/"מחר" → tomorrow's date
  - "next week"/"שבוע הבא" → next Monday
  - "today"/"היום" → today's date
  - Explicit dates in any format → YYYY-MM-DD
  - No date mentioned → null
- Detect duration hints: "quick"/"5 min"/"מהיר" → 15, "meeting"/"call"/"פגישה"/"שיחה" → 30, default 25
- If Hebrew, translate title to English but keep original text in notes
- If the message is NOT a task (greeting, meme, emoji-only, general chat, question): return {"isTask": false}

Respond with JSON only. No markdown, no code fences, no explanation.
{"isTask": true, "title": "...", "priority": "medium", "dueDate": "YYYY-MM-DD or null", "duration": 25, "notes": "..."}`

export async function parseMessage(text: string): Promise<ParsedTask | null> {
  const apiKey = process.env.GROQ_API_KEY
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'

  if (!apiKey) {
    console.error('[GROQ] GROQ_API_KEY is not set')
    return null
  }

  // Inject today's date into the system prompt
  const today = new Date().toISOString().split('T')[0]
  const systemPrompt = SYSTEM_PROMPT.replace('{{TODAY}}', today)

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text },
        ],
        temperature: 0.1,
        max_tokens: 256,
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[GROQ] API error ${response.status}: ${errorText}`)
      return null
    }

    const data = (await response.json()) as unknown

    // Validate response structure
    if (
      !data ||
      typeof data !== 'object' ||
      !('choices' in data) ||
      !Array.isArray(data.choices) ||
      data.choices.length === 0
    ) {
      console.error('[GROQ] Invalid response structure')
      return null
    }

    const firstChoice = data.choices[0]
    if (
      !firstChoice ||
      typeof firstChoice !== 'object' ||
      !('message' in firstChoice) ||
      !firstChoice.message ||
      typeof firstChoice.message !== 'object' ||
      !('content' in firstChoice.message) ||
      typeof firstChoice.message.content !== 'string'
    ) {
      console.error('[GROQ] Invalid choice structure')
      return null
    }

    const content = firstChoice.message.content

    if (!content) {
      console.error('[GROQ] Empty response from API')
      return null
    }

    let parsed: ParseResult
    try {
      parsed = JSON.parse(content) as ParseResult
    } catch (parseError) {
      console.error('[GROQ] Failed to parse JSON response:', parseError)
      return null
    }

    if (!parsed.isTask || !parsed.title) {
      return null
    }

    return {
      title: parsed.title,
      priority: parsed.priority || 'medium',
      dueDate: parsed.dueDate || undefined,
      duration: parsed.duration || 25,
      status: 'planned',
      notes: parsed.notes || undefined,
    }
  } catch (error) {
    console.error('[GROQ] Parse error:', error instanceof Error ? error.message : error)
    return null
  }
}
