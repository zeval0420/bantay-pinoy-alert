-- Add name field to hazard_reports table
ALTER TABLE public.hazard_reports
ADD COLUMN name TEXT;

-- Update existing reports to have a name based on hazard_type
UPDATE public.hazard_reports
SET name = hazard_type
WHERE name IS NULL;