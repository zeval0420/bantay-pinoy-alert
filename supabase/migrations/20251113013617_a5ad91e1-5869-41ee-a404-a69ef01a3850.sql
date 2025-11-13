-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create hazard_reports table
CREATE TABLE public.hazard_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  image_url TEXT NOT NULL,
  hazard_type TEXT NOT NULL,
  description TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.hazard_reports ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (authorities need to see all reports)
CREATE POLICY "Anyone can view hazard reports" 
ON public.hazard_reports 
FOR SELECT 
USING (true);

-- Create policy for inserting reports (anyone can submit)
CREATE POLICY "Anyone can create hazard reports" 
ON public.hazard_reports 
FOR INSERT 
WITH CHECK (true);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_hazard_reports_updated_at
BEFORE UPDATE ON public.hazard_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for hazard images
INSERT INTO storage.buckets (id, name, public)
VALUES ('hazard-images', 'hazard-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for hazard images
CREATE POLICY "Anyone can view hazard images" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'hazard-images');

CREATE POLICY "Anyone can upload hazard images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'hazard-images');