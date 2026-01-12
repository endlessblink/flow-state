-- ============================================================================
-- Migration: Add version tracking and update coordinates to absolute
-- ============================================================================
-- This migration adds optimistic locking support to prevent sync conflicts
-- and sets up the foundation for storing absolute coordinates

-- Step 1: Add version field for optimistic locking
ALTER TABLE nodes ADD COLUMN version INTEGER DEFAULT 1 NOT NULL;
ALTER TABLE nodes ADD COLUMN updated_at TIMESTAMP DEFAULT NOW() NOT NULL;

-- Step 2: Create index for efficient conflict detection
CREATE INDEX idx_nodes_version ON nodes(id, version);
CREATE INDEX idx_nodes_updated_at ON nodes(updated_at DESC);

-- Step 3: Create migration log table for debugging position changes
CREATE TABLE IF NOT EXISTS node_position_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  old_position JSONB NOT NULL,
  new_position JSONB NOT NULL,
  change_reason VARCHAR(255) NOT NULL,
  changed_at TIMESTAMP DEFAULT NOW() NOT NULL,
  changed_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_node_position_history_node_id ON node_position_history(node_id);
CREATE INDEX idx_node_position_history_changed_at ON node_position_history(changed_at DESC);

-- Step 4: Add trigger to auto-update version on position change
CREATE OR REPLACE FUNCTION increment_node_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version = OLD.version + 1;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_increment_node_version
BEFORE UPDATE ON nodes
FOR EACH ROW
WHEN (OLD.position IS DISTINCT FROM NEW.position)
EXECUTE FUNCTION increment_node_version();

-- Step 5: Add trigger to log position changes (for debugging)
CREATE OR REPLACE FUNCTION log_position_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO node_position_history (node_id, old_position, new_position, change_reason)
  VALUES (NEW.id, OLD.position, NEW.position, 'user_drag');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_log_position_change
AFTER UPDATE ON nodes
FOR EACH ROW
WHEN (OLD.position IS DISTINCT FROM NEW.position)
EXECUTE FUNCTION log_position_change();

-- Step 6: Policy for version conflicts (optional RLS policy)
-- This ensures the application layer checks version before updating
CREATE POLICY nodes_version_conflict_protection ON nodes
  FOR UPDATE USING (version = CURRENT_SETTING('app.node_version')::integer);