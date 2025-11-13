-- Revert user_id to nullable for anonymous reports
ALTER TABLE hazard_reports
ALTER COLUMN user_id DROP NOT NULL;

-- Add fields for hazard fixes
ALTER TABLE hazard_reports
ADD COLUMN IF NOT EXISTS fixed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS fixed_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS fix_image_url TEXT,
ADD COLUMN IF NOT EXISTS fix_notes TEXT;

-- Create app_role enum for user roles (only if not exists)
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create user_roles table for role management
CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check admin status
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = check_user_id
      AND role = 'admin'
  )
$$;

-- Update RLS policies for public access
DROP POLICY IF EXISTS "Anyone can view hazard reports" ON hazard_reports;
DROP POLICY IF EXISTS "Anyone can create hazard reports" ON hazard_reports;
DROP POLICY IF EXISTS "Users can update own reports" ON hazard_reports;
DROP POLICY IF EXISTS "Users can delete own reports" ON hazard_reports;

-- Public can view all reports
CREATE POLICY "Public can view hazard reports"
ON hazard_reports
FOR SELECT
USING (true);

-- Anyone can create reports (authenticated or anonymous)
CREATE POLICY "Anyone can create hazard reports"
ON hazard_reports
FOR INSERT
WITH CHECK (true);

-- Only admins can update reports
CREATE POLICY "Admins can update all reports"
ON hazard_reports
FOR UPDATE
USING (public.is_admin(auth.uid()));

-- Admins can delete, or report creators can delete their own
CREATE POLICY "Admins and owners can delete reports"
ON hazard_reports
FOR DELETE
USING (
  public.is_admin(auth.uid()) OR 
  (auth.uid() = user_id AND user_id IS NOT NULL)
);

-- Update storage policies for public access
DROP POLICY IF EXISTS "Authenticated users can upload hazard images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own images" ON storage.objects;

-- Anyone can upload hazard images
CREATE POLICY "Anyone can upload hazard images"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'hazard-images');

-- Only admins can update storage objects
CREATE POLICY "Admins can update images"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'hazard-images' AND
  public.is_admin(auth.uid())
);

-- Admins can delete images
CREATE POLICY "Admins can delete images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'hazard-images' AND
  public.is_admin(auth.uid())
);

-- User roles policies
CREATE POLICY "Admins can view all roles"
ON user_roles
FOR SELECT
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can manage roles"
ON user_roles
FOR ALL
USING (public.is_admin(auth.uid()));