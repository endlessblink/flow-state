/**
 * Sends a text message via WAHA (WhatsApp HTTP API).
 * POST /api/sendText with session 'default'.
 */
export async function sendMessage(chatId: string, text: string): Promise<void> {
  const wahaUrl = process.env.WAHA_URL || 'http://localhost:3000'
  const apiKey = process.env.WAHA_API_KEY

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (apiKey) {
    headers['X-Api-Key'] = apiKey
  }

  try {
    const response = await fetch(`${wahaUrl}/api/sendText`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        session: 'default',
        chatId,
        text,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`[WAHA] Send error ${response.status}: ${errorText}`)
    }
  } catch (error) {
    console.error('[WAHA] Send failed:', error instanceof Error ? error.message : error)
  }
}
