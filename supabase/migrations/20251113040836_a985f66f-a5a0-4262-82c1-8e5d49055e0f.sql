-- Clean up existing null user_id values
DELETE FROM hazard_reports WHERE user_id IS NULL;

-- Make user_id NOT NULL
ALTER TABLE hazard_reports
ALTER COLUMN user_id SET NOT NULL;

-- Add CHECK constraints for field lengths
ALTER TABLE hazard_reports
ADD CONSTRAINT check_description_length CHECK (char_length(description) >= 10 AND char_length(description) <= 2000);

ALTER TABLE hazard_reports
ADD CONSTRAINT check_hazard_type_length CHECK (char_length(hazard_type) >= 1 AND char_length(hazard_type) <= 100);

ALTER TABLE hazard_reports
ADD CONSTRAINT check_location_name_length CHECK (location_name IS NULL OR char_length(location_name) <= 500);

-- Add coordinate range validation
ALTER TABLE hazard_reports
ADD CONSTRAINT check_coordinates CHECK (
  latitude >= -90 AND latitude <= 90 AND
  longitude >= -180 AND longitude <= 180
);

-- Add UPDATE policy for hazard_reports
CREATE POLICY "Users can update own reports" 
ON hazard_reports 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Add DELETE policy for hazard_reports
CREATE POLICY "Users can delete own reports" 
ON hazard_reports 
FOR DELETE 
USING (auth.uid() = user_id);

-- Drop the overly permissive storage policy
DROP POLICY IF EXISTS "Anyone can upload hazard images" ON storage.objects;

-- Create authenticated upload policy with user folder isolation
CREATE POLICY "Authenticated users can upload hazard images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'hazard-images' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Create policy for users to update their own images
CREATE POLICY "Users can update own images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'hazard-images' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Create policy for users to delete their own images
CREATE POLICY "Users can delete own images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'hazard-images' AND
  auth.uid() IS NOT NULL AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Set file size limit to 5MB
UPDATE storage.buckets
SET file_size_limit = 5242880
WHERE id = 'hazard-images';

-- Restrict to image MIME types only
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
WHERE id = 'hazard-images';