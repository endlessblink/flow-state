-- FEATURE-1414: Task Image Attachments via Google Drive
-- Adds JSONB column to store attachment metadata (file IDs, names, thumbnails).
-- Actual image data lives in Google Drive, not in the database.
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]';

-- Comment for documentation
COMMENT ON COLUMN tasks.attachments IS 'FEATURE-1414: Array of {id, driveFileId, name, mimeType, thumbnailUrl, uploadedAt} objects. Images stored in Google Drive.';
