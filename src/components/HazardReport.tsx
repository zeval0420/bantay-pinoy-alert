import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Camera, MapPin, Upload, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { hazardReportSchema, imageFileSchema } from "@/lib/validation";
import { z } from "zod";

export const HazardReport = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hazardType, setHazardType] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState({ lat: 0, lng: 0, name: "" });
  const [gettingLocation, setGettingLocation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = async (file: File) => {
    try {
      // Validate image file
      imageFileSchema.parse({
        type: file.type,
        size: file.size
      });

      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);

      // Auto-analyze the image
      await analyzeImage(file);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Invalid image file");
      }
    }
  };

  const analyzeImage = async (file: File) => {
    setAnalyzing(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Image = reader.result as string;

        const { data, error } = await supabase.functions.invoke('analyze-hazard', {
          body: { imageBase64: base64Image }
        });

        if (error) throw error;

        setHazardType(data.hazard_type);
        setDescription(data.description);
        toast.success("Image analyzed successfully!");
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Error analyzing image:", error);
      toast.error("Failed to analyze image. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  const getLocation = () => {
    setGettingLocation(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          // Get location name using reverse geocoding (OpenStreetMap)
          try {
            const response = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
            );
            const data = await response.json();
            const locationName = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
            
            setLocation({ lat, lng, name: locationName });
            toast.success("Location captured!");
          } catch (error) {
            setLocation({ lat, lng, name: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
            toast.success("Location captured!");
          }
          setGettingLocation(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          toast.error("Failed to get location. Please enable location services.");
          setGettingLocation(false);
        }
      );
    } else {
      toast.error("Geolocation is not supported by your browser");
      setGettingLocation(false);
    }
  };

  const handleSubmit = async () => {
    try {
      // Validate form data
      const validated = hazardReportSchema.parse({
        hazard_type: hazardType,
        description: description,
        latitude: location.lat,
        longitude: location.lng,
        location_name: location.name || undefined,
      });

      if (!imageFile) {
        toast.error("Please select an image");
        return;
      }

      setSubmitting(true);

      // Get current user (optional for anonymous reports)
      const { data: { user } } = await supabase.auth.getUser();

      // Upload image to storage
      const fileExt = imageFile.name.split('.').pop();
      const fileName = user 
        ? `${user.id}/${Date.now()}.${fileExt}`
        : `anonymous/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('hazard-images')
        .upload(fileName, imageFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('hazard-images')
        .getPublicUrl(fileName);

      // Insert hazard report with validated data and optional user_id
      const { error: insertError } = await supabase
        .from('hazard_reports')
        .insert({
          user_id: user?.id || null,
          image_url: publicUrl,
          hazard_type: validated.hazard_type,
          description: validated.description,
          latitude: validated.latitude,
          longitude: validated.longitude,
          location_name: validated.location_name,
        });

      if (insertError) throw insertError;

      toast.success("Hazard report submitted successfully!");
      
      // Reset form
      setSelectedImage(null);
      setImageFile(null);
      setHazardType("");
      setDescription("");
      setLocation({ lat: 0, lng: 0, name: "" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        console.error("Error submitting report:", error);
        toast.error("Failed to submit report. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-warning" />
          Report a Hazard
        </h2>
        
        {/* Image Upload Section */}
        <div className="space-y-4">
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="w-4 h-4 mr-2" />
              Take Photo
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Image
            </Button>
          </div>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
          />

          {selectedImage && (
            <div className="relative">
              <img
                src={selectedImage}
                alt="Selected hazard"
                className="w-full h-48 object-cover rounded-lg"
              />
              {analyzing && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
            </div>
          )}

          {/* Location Section */}
          <div className="space-y-2">
            <Label>Location</Label>
            <div className="flex gap-2">
              <Input
                value={location.name}
                onChange={(e) => setLocation({ ...location, name: e.target.value })}
                placeholder="Location will be auto-detected"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={getLocation}
                disabled={gettingLocation}
              >
                {gettingLocation ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MapPin className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Hazard Type Section */}
          <div className="space-y-2">
            <Label htmlFor="hazard-type">Hazard Type</Label>
            <Input
              id="hazard-type"
              value={hazardType}
              onChange={(e) => setHazardType(e.target.value)}
              placeholder="AI will classify the hazard"
            />
          </div>

          {/* Description Section */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="AI will generate a description"
              rows={4}
            />
          </div>

          {/* Submit Button */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!imageFile || !hazardType || !description || !location.lat || submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit Hazard Report"
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
};
