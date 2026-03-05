-- WhatsApp conversation state for the AI task bot
-- Tracks in-progress conversations so the bot can handle multi-step interactions
-- (e.g., confirm task details, change priority, pick project before creating)

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chat_id text NOT NULL,
  state text NOT NULL DEFAULT 'awaiting_confirm',
  original_message text,
  extracted_title text,
  extracted_description text,
  priority text DEFAULT 'medium',
  project_id uuid,
  project_name text,
  waha_message_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Fast lookup by chat_id + user_id (the combo that identifies a conversation)
CREATE INDEX idx_wa_conv_chat ON whatsapp_conversations(chat_id, user_id);

-- RLS
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own conversations"
  ON whatsapp_conversations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role bypass (edge function uses service role key)
CREATE POLICY "Service role full access"
  ON whatsapp_conversations
  FOR ALL
  USING (auth.role() = 'service_role');
