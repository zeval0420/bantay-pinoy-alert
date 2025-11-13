import { useState, useEffect } from "react";
import { AlertCard } from "@/components/AlertCard";
import { AlertDetails } from "@/components/AlertDetails";
import { BottomNav } from "@/components/BottomNav";
import { MapView } from "@/components/MapView";
import { Checklist } from "@/components/Checklist";
import { EmergencyContacts } from "@/components/EmergencyContacts";
import { NotificationDrawer } from "@/components/NotificationDrawer";
import { HazardReport } from "@/components/HazardReport";
import { Alert } from "@/types/alert";
import { AlertCircle, Bell, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";

// Sample alert data
const sampleAlerts: Alert[] = [
  {
    id: '1',
    title: 'Typhoon Nina Approaching Metro Manila',
    severity: 'critical',
    type: 'typhoon',
    description: 'Super Typhoon Nina is expected to make landfall in Metro Manila within 12 hours. Wind speeds reaching 220 km/h with heavy rainfall expected.',
    location: 'Metro Manila, NCR',
    time: new Date(),
    safeZones: ['Quezon City Hall Evacuation Center', 'Marikina Sports Complex', 'Manila City Gym'],
    instructions: [
      'Evacuate to the nearest designated safe zone immediately',
      'Secure all loose items outdoors',
      'Store at least 3 days worth of food and water',
      'Charge all electronic devices',
      'Stay away from windows and doors',
      'Monitor official weather updates continuously',
    ],
  },
  {
    id: '2',
    title: 'Earthquake Warning - Magnitude 5.8',
    severity: 'warning',
    type: 'earthquake',
    description: 'A moderate earthquake has been detected. Aftershocks expected in the next 24-48 hours.',
    location: 'Batangas Province',
    time: new Date(Date.now() - 3600000),
    safeZones: ['Open fields near City Center', 'Provincial Gymnasium'],
    instructions: [
      'Drop, Cover, and Hold during aftershocks',
      'Stay away from tall buildings and structures',
      'Check for structural damage in your home',
      'Prepare emergency kit in case of stronger aftershocks',
      'Keep emergency numbers readily available',
    ],
  },
  {
    id: '3',
    title: 'Flash Flood Advisory',
    severity: 'warning',
    type: 'flood',
    description: 'Heavy rainfall has caused rapid water level rise in low-lying areas. Flooding expected within 2-3 hours.',
    location: 'Bulacan and nearby provinces',
    time: new Date(Date.now() - 7200000),
    safeZones: ['San Jose Elementary School (2nd Floor)', 'Municipal Hall Evacuation Center'],
    instructions: [
      'Move to higher ground immediately',
      'Avoid crossing flooded areas',
      'Turn off electricity if water enters your home',
      'Bring important documents and valuables to higher floors',
      'Monitor water levels continuously',
    ],
  },
  {
    id: '4',
    title: 'Weather Advisory - Heavy Monsoon Rains',
    severity: 'advisory',
    type: 'flood',
    description: 'Southwest monsoon enhanced by weather system. Expect moderate to heavy rains in the next 24 hours.',
    location: 'Luzon Region',
    time: new Date(Date.now() - 10800000),
    instructions: [
      'Monitor weather updates regularly',
      'Prepare emergency supplies',
      'Clear drainage systems around your property',
      'Avoid unnecessary travel',
    ],
  },
];

const Index = () => {
  const [activeTab, setActiveTab] = useState('alerts');
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [alerts] = useState<Alert[]>(sampleAlerts);
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check session and admin status
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        checkAdminStatus(session.user.id);
      }
    });

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        checkAdminStatus(session.user.id);
      } else {
        setIsAdmin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdminStatus = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .single();
    
    setIsAdmin(!!data);
  };

  if (selectedAlert) {
    return <AlertDetails alert={selectedAlert} onBack={() => setSelectedAlert(null)} />;
  }

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="container max-w-2xl mx-auto p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary rounded-lg">
                <AlertCircle className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">AlertPH</h1>
                <p className="text-xs text-muted-foreground">Emergency Alert System</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => setNotificationDrawerOpen(true)}
              >
                <Bell className="w-6 h-6 text-foreground" />
                {criticalCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-xs animate-pulse"
                  >
                    {criticalCount}
                  </Badge>
                )}
              </Button>
              {isAdmin ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/admin')}
                  className="flex items-center gap-1"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className="text-xs">Admin</span>
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/auth')}
                  className="text-xs"
                >
                  Admin Login
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container max-w-2xl mx-auto p-4">
        {activeTab === 'alerts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">Active Alerts</h2>
              <Badge variant="outline">{alerts.length} alerts</Badge>
            </div>
            
            {criticalCount > 0 && (
              <div className="bg-critical/10 border border-critical/20 rounded-lg p-4">
                <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {criticalCount} Critical {criticalCount === 1 ? 'Alert' : 'Alerts'} - Immediate Action Required
                </p>
              </div>
            )}

            <div className="space-y-3">
              {alerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onClick={() => setSelectedAlert(alert)}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === 'map' && <MapView />}
        {activeTab === 'report' && <HazardReport />}
        {activeTab === 'checklist' && <Checklist />}
        {activeTab === 'contacts' && <EmergencyContacts />}
      </main>

      {/* Bottom Navigation */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Notification Drawer */}
      <NotificationDrawer
        isOpen={notificationDrawerOpen}
        onClose={() => setNotificationDrawerOpen(false)}
        alerts={alerts}
        onAlertClick={setSelectedAlert}
      />
    </div>
  );
};

export default Index;
