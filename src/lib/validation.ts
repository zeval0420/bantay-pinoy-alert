import { z } from "zod";

export const hazardReportSchema = z.object({
  name: z.string().trim().min(1, "Hazard name is required").max(100, "Hazard name too long"),
  hazard_type: z.string().trim().min(1, "Hazard type is required").max(100, "Hazard type too long"),
  description: z.string().trim().min(10, "Description must be at least 10 characters").max(2000, "Description too long (max 2000 characters)"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  location_name: z.string().trim().max(500).optional(),
});

export const imageFileSchema = z.object({
  type: z.string().refine((type) => type.startsWith('image/'), {
    message: "Only image files are allowed",
  }),
  size: z.number().max(5 * 1024 * 1024, {
    message: "Image size must be less than 5MB",
  }),
});

export type HazardReportInput = z.infer<typeof hazardReportSchema>;
