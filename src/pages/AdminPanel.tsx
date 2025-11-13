import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { LogOut, Camera, Loader2, CheckCircle, MapPin } from "lucide-react";
import { toast } from "sonner";

interface HazardReport {
  id: string;
  hazard_type: string;
  description: string;
  location_name: string | null;
  latitude: number;
  longitude: number;
  image_url: string;
  status: string;
  created_at: string;
  fixed_at: string | null;
  fix_image_url: string | null;
  fix_notes: string | null;
}

const AdminPanel = () => {
  const [reports, setReports] = useState<HazardReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<HazardReport | null>(null);
  const [fixImage, setFixImage] = useState<File | null>(null);
  const [fixImagePreview, setFixImagePreview] = useState<string | null>(null);
  const [fixNotes, setFixNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkAdminAndLoadReports();
  }, []);

  const checkAdminAndLoadReports = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate('/auth');
      return;
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      toast.error("Access denied. Admin credentials required.");
      navigate('/');
      return;
    }

    loadReports();
  };

  const loadReports = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('hazard_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error("Failed to load reports");
      console.error(error);
    } else {
      setReports(data || []);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleImageSelect = (file: File) => {
    setFixImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setFixImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleMarkAsFixed = async () => {
    if (!selectedReport || !fixImage) {
      toast.error("Please take a photo of the fixed hazard");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload fix image
      const fileExt = fixImage.name.split('.').pop();
      const fileName = `fixes/${selectedReport.id}_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('hazard-images')
        .upload(fileName, fixImage);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('hazard-images')
        .getPublicUrl(fileName);

      // Update report as fixed
      const { error: updateError } = await supabase
        .from('hazard_reports')
        .update({
          status: 'resolved',
          fixed_at: new Date().toISOString(),
          fixed_by: user.id,
          fix_image_url: publicUrl,
          fix_notes: fixNotes || null,
        })
        .eq('id', selectedReport.id);

      if (updateError) throw updateError;

      toast.success("Hazard marked as fixed!");
      setSelectedReport(null);
      setFixImage(null);
      setFixImagePreview(null);
      setFixNotes("");
      loadReports();
    } catch (error) {
      console.error("Error marking as fixed:", error);
      toast.error("Failed to mark hazard as fixed");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (selectedReport) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="container max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" onClick={() => setSelectedReport(null)}>
              ← Back
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Mark Hazard as Fixed
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Original Report</h3>
                <img
                  src={selectedReport.image_url}
                  alt="Hazard"
                  className="w-full h-48 object-cover rounded-lg mb-2"
                />
                <p className="text-sm"><strong>Type:</strong> {selectedReport.hazard_type}</p>
                <p className="text-sm"><strong>Description:</strong> {selectedReport.description}</p>
                <p className="text-sm flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {selectedReport.location_name || `${selectedReport.latitude}, ${selectedReport.longitude}`}
                </p>
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2">Photo of Fixed Hazard *</h3>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Take Photo of Fixed Hazard
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
                />

                {fixImagePreview && (
                  <img
                    src={fixImagePreview}
                    alt="Fix"
                    className="w-full h-48 object-cover rounded-lg mt-2"
                  />
                )}
              </div>

              <div>
                <h3 className="font-semibold mb-2">Fix Notes (Optional)</h3>
                <Textarea
                  value={fixNotes}
                  onChange={(e) => setFixNotes(e.target.value)}
                  placeholder="Add any notes about the fix..."
                  rows={3}
                />
              </div>

              <Button
                className="w-full"
                onClick={handleMarkAsFixed}
                disabled={!fixImage || submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Confirm Fix
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="container max-w-2xl mx-auto p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">Admin Dashboard</h1>
              <p className="text-xs text-muted-foreground">Manage Hazard Reports</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/')}>
                Public Site
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-2xl mx-auto p-4">
        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-2">All Hazard Reports</h2>
          <div className="flex gap-2">
            <Badge variant="outline">
              {reports.length} Total
            </Badge>
            <Badge variant="outline">
              {reports.filter(r => r.status === 'pending').length} Pending
            </Badge>
            <Badge variant="outline">
              {reports.filter(r => r.status === 'resolved').length} Resolved
            </Badge>
          </div>
        </div>

        <div className="space-y-3">
          {reports.map((report) => (
            <Card key={report.id} className={report.status === 'resolved' ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <img
                    src={report.image_url}
                    alt="Hazard"
                    className="w-20 h-20 object-cover rounded"
                  />
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="font-semibold text-sm">{report.hazard_type}</h3>
                      <Badge variant={report.status === 'resolved' ? 'default' : 'secondary'}>
                        {report.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {report.description}
                    </p>
                    <p className="text-xs flex items-center gap-1 mb-2">
                      <MapPin className="w-3 h-3" />
                      {report.location_name || `${report.latitude}, ${report.longitude}`}
                    </p>
                    {report.status === 'pending' && (
                      <Button
                        size="sm"
                        onClick={() => setSelectedReport(report)}
                        className="w-full"
                      >
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Mark as Fixed
                      </Button>
                    )}
                    {report.status === 'resolved' && report.fix_image_url && (
                      <div className="mt-2 p-2 bg-muted rounded text-xs">
                        <p className="font-semibold mb-1">Fixed on {new Date(report.fixed_at!).toLocaleDateString()}</p>
                        {report.fix_notes && <p>{report.fix_notes}</p>}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {reports.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No hazard reports yet
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminPanel;
