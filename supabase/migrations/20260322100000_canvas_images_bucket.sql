-- Create canvas-images bucket for paste-to-canvas screenshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'canvas-images',
  'canvas-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload images
CREATE POLICY "Users can upload canvas images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'canvas-images');

-- Allow anyone to view (public bucket for simplicity)
CREATE POLICY "Public read access for canvas images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'canvas-images');

-- Allow users to delete their own images (path starts with their user id)
CREATE POLICY "Users can delete own canvas images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'canvas-images' AND (storage.foldername(name))[1] = auth.uid()::text);
