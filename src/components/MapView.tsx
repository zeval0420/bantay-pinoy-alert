import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, AlertTriangle, Bell, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { calculateDistance, formatDistance } from "@/lib/geolocation";
import { useHazardNotifications } from "@/hooks/useHazardNotifications";

interface HazardReport {
  id: string;
  name: string | null;
  hazard_type: string;
  description: string;
  latitude: number;
  longitude: number;
  location_name: string | null;
  created_at: string;
  status: string;
  image_url: string;
  fix_image_url: string | null;
  fix_notes: string | null;
  fixed_at: string | null;
}

// Vigan, Ilocos Sur coordinates
const VIGAN_CENTER: [number, number] = [17.5747, 120.3869];

// Comprehensive list of safe zones in Vigan and surrounding areas
const ALL_SAFE_ZONES = [
  { name: "Vigan City Hall", position: [17.5741, 120.3868] as [number, number] },
  { name: "Vigan Convention Center", position: [17.5720, 120.3890] as [number, number] },
  { name: "Bantay Church", position: [17.5920, 120.3890] as [number, number] },
  { name: "Plaza Salcedo", position: [17.5745, 120.3875] as [number, number] },
  { name: "Vigan Cathedral", position: [17.5750, 120.3870] as [number, number] },
  { name: "Bantay Bell Tower", position: [17.5925, 120.3895] as [number, number] },
  { name: "Mindoro Beach", position: [17.5450, 120.3650] as [number, number] },
  { name: "Vigan Sports Complex", position: [17.5780, 120.3920] as [number, number] },
  { name: "Santo Domingo Church", position: [17.5735, 120.3860] as [number, number] },
  { name: "Vigan Public Market", position: [17.5738, 120.3882] as [number, number] },
];

// Evacuation route definitions (waypoints)
const evacuationRouteWaypoints = [
  {
    id: "route-a",
    name: "Coastal Highway Route",
    status: "clear",
    description: "Clear - Recommended",
    waypoints: [
      [17.5747, 120.3869] as [number, number],
      [17.5920, 120.3890] as [number, number], // Bantay Church
    ],
    color: "#10B981",
  },
  {
    id: "route-b",
    name: "Heritage Village Route",
    status: "clear",
    description: "Clear - Alternative route",
    waypoints: [
      [17.5747, 120.3869] as [number, number],
      [17.5741, 120.3868] as [number, number], // Vigan City Hall
    ],
    color: "#10B981",
  },
  {
    id: "route-c",
    name: "River Road",
    status: "closed",
    description: "Closed - Flooding reported",
    waypoints: [
      [17.5747, 120.3869] as [number, number],
      [17.5600, 120.3810] as [number, number],
    ],
    color: "#DC2626",
  },
];

// Danger zone
const dangerZone = {
  center: [17.5600, 120.3810] as [number, number],
  radius: 2000, // meters
};

// Helper function to check if a point is near any hazards
const isNearHazard = (
  point: [number, number],
  hazards: HazardReport[],
  radiusKm: number = 0.5
): boolean => {
  return hazards.some(hazard => {
    if (hazard.status === 'fixed') return false; // Ignore resolved hazards
    const distance = calculateDistance(
      point[0],
      point[1],
      hazard.latitude,
      hazard.longitude
    );
    return distance <= radiusKm;
  });
};

// Helper function to calculate route safety score (0-100, higher is safer)
const calculateRouteSafety = (
  routeCoordinates: [number, number][],
  hazards: HazardReport[]
): number => {
  if (hazards.length === 0) return 100;
  
  let hazardProximityScore = 0;
  const samplePoints = routeCoordinates.filter((_, idx) => idx % 5 === 0); // Sample every 5th point
  
  samplePoints.forEach(point => {
    hazards.forEach(hazard => {
      if (hazard.status === 'fixed') return;
      const distance = calculateDistance(
        point[0],
        point[1],
        hazard.latitude,
        hazard.longitude
      );
      // Closer hazards have more impact
      if (distance < 0.5) hazardProximityScore += 10;
      else if (distance < 1) hazardProximityScore += 5;
      else if (distance < 2) hazardProximityScore += 2;
    });
  });
  
  return Math.max(0, 100 - hazardProximityScore);
};

// Helper function to fetch route from OSRM
const fetchRoute = async (waypoints: [number, number][]) => {
  try {
    // Format: longitude,latitude;longitude,latitude
    const coords = waypoints.map(([lat, lng]) => `${lng},${lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.code === 'Ok' && data.routes && data.routes[0]) {
      // Convert GeoJSON coordinates [lng, lat] to Leaflet format [lat, lng]
      return data.routes[0].geometry.coordinates.map(([lng, lat]: [number, number]) => [lat, lng] as [number, number]);
    }
    
    return waypoints; // Fallback to straight line if routing fails
  } catch (error) {
    console.error('Error fetching route:', error);
    return waypoints; // Fallback to straight line
  }
};

// Leaflet Map Component
const LeafletMap = ({ 
  selectedRoute,
  hazardReports,
  currentLocation,
  evacuationRoutes,
  onHazardClick,
  nearbySafeZones,
  routeSafetyScores
}: { 
  selectedRoute: string | null;
  hazardReports: HazardReport[];
  currentLocation: [number, number];
  evacuationRoutes: typeof evacuationRouteWaypoints;
  onHazardClick: (report: HazardReport) => void;
  nearbySafeZones: Array<{ name: string; position: [number, number]; distance: number }>;
  routeSafetyScores: Record<string, number>;
}) => {
  const mapRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const routeLayers = useRef<any>({});
  const hazardMarkers = useRef<any[]>([]);

  useEffect(() => {
    let mapInstance: any = null;

    // Dynamically import Leaflet
    const initMap = async () => {
      try {
        const L = await import('leaflet');
        await import('leaflet/dist/leaflet.css');

        // Fix default marker icon issue
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        });

        // Create map
        mapInstance = L.map('map').setView(currentLocation, 13);
        mapRef.current = mapInstance;

        // Add current location marker
        const currentLocationIcon = L.divIcon({
          className: 'current-location-icon',
          html: `<div style="background-color: #3B82F6; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
            <div style="width: 8px; height: 8px; background-color: white; border-radius: 50%;"></div>
          </div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        L.marker(currentLocation, { icon: currentLocationIcon })
          .addTo(mapInstance)
          .bindPopup('<div class="text-sm"><p class="font-bold">Your Location</p></div>');

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(mapInstance);

        // Add danger zone circle
        L.circle(dangerZone.center, {
          color: '#DC2626',
          fillColor: '#DC2626',
          fillOpacity: 0.2,
          radius: dangerZone.radius
        }).addTo(mapInstance).bindPopup('<div class="text-sm"><p class="font-bold">Danger Zone</p><p>Flooding reported in this area</p></div>');

        // Add safe zone markers (only nearby ones)
        nearbySafeZones.forEach((zone) => {
          L.marker(zone.position)
            .addTo(mapInstance)
            .bindPopup(`<div class="text-sm"><p class="font-bold">${zone.name}</p><p class="text-xs">Safe Zone - ${formatDistance(zone.distance)}</p></div>`);
        });

        // Add evacuation routes with real road-based routing and safety info
        const routePromises = evacuationRoutes.map(async (route) => {
          const roadCoordinates = await fetchRoute(route.waypoints);
          const safetyScore = routeSafetyScores[route.id] || 100;
          const safetyText = safetyScore >= 80 ? '✓ Safe route' : safetyScore >= 50 ? '⚠ Caution - hazards nearby' : '⚠ High risk - hazards on route';
          
          const polyline = L.polyline(roadCoordinates, {
            color: route.color,
            weight: 4,
            opacity: 0.7
          }).addTo(mapInstance);
          
          polyline.bindPopup(`<div class="text-sm"><p class="font-bold">${route.name}</p><p class="text-xs">${route.description}</p><p class="text-xs mt-1"><strong>Safety Score:</strong> ${safetyScore}/100 - ${safetyText}</p></div>`);
          
          // Store polyline reference
          routeLayers.current[route.id] = { polyline, defaultColor: route.color };
        });

        await Promise.all(routePromises);

        // Add hazard report markers
        hazardReports.forEach((report) => {
          const isResolved = report.status === 'fixed';
          const hazardIcon = L.divIcon({
            className: 'custom-hazard-icon',
            html: `<div style="background-color: ${isResolved ? '#10B981' : '#DC2626'}; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3); cursor: pointer;">${isResolved ? '✓' : '!'}</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });

          const marker = L.marker([report.latitude, report.longitude], { icon: hazardIcon })
            .addTo(mapInstance);
          
          marker.on('click', () => {
            onHazardClick(report);
          });

          hazardMarkers.current.push(marker);
        });

        setMapLoaded(true);
      } catch (error) {
        console.error('Error loading map:', error);
      }
    };

    initMap();

    // Cleanup
    return () => {
      // Remove hazard markers
      hazardMarkers.current.forEach(marker => marker.remove());
      hazardMarkers.current = [];
      
      if (mapInstance) {
      mapInstance.remove();
    }
  };
}, [hazardReports, currentLocation, evacuationRoutes, onHazardClick, nearbySafeZones, routeSafetyScores]);

  // Handle route highlighting
  useEffect(() => {
    if (!mapLoaded) return;

    Object.entries(routeLayers.current).forEach(([routeId, layer]: [string, any]) => {
      if (routeId === selectedRoute) {
        // Highlight selected route in amber
        layer.polyline.setStyle({ color: '#F59E0B', weight: 6, opacity: 1 });
      } else if (selectedRoute) {
        // Gray out non-selected routes when a route is selected
        layer.polyline.setStyle({ color: '#9CA3AF', weight: 3, opacity: 0.4 });
      } else {
        // Show default colors when no route is selected
        layer.polyline.setStyle({ color: layer.defaultColor, weight: 4, opacity: 0.7 });
      }
    });
  }, [selectedRoute, mapLoaded]);

  return (
    <>
      {!mapLoaded && (
        <div className="absolute inset-0 bg-muted flex items-center justify-center z-10 animate-pulse">
          <p className="text-muted-foreground">Loading map...</p>
        </div>
      )}
      <div id="map" className="h-full w-full" />
    </>
  );
};

export const MapView = () => {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [hazardReports, setHazardReports] = useState<HazardReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [selectedHazard, setSelectedHazard] = useState<HazardReport | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const hasInitialized = useRef(false);

  // Enable hazard notifications
  useHazardNotifications(currentLocation, notificationsEnabled);

  // Get user's current location (only once on mount)
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation([position.coords.latitude, position.coords.longitude]);
          setLocationError(null);
        },
        (error) => {
          console.error('Error getting location:', error);
          setLocationError('Unable to get your location. Using default location.');
          setCurrentLocation(VIGAN_CENTER); // Fallback to Vigan center
        }
      );
    } else {
      setLocationError('Geolocation is not supported by your browser.');
      setCurrentLocation(VIGAN_CENTER); // Fallback to Vigan center
    }
  }, []);

  // Memoize fetch function to prevent unnecessary re-renders
  const fetchHazardReports = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('hazard_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setHazardReports(data || []);
    } catch (error) {
      console.error('Error fetching hazard reports:', error);
      toast.error('Failed to load hazard reports');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch hazard reports only on mount
  useEffect(() => {
    fetchHazardReports();

    // Set up realtime subscription
    const channel = supabase
      .channel('hazard-reports-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'hazard_reports'
        },
        () => {
          fetchHazardReports();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchHazardReports]);

  const handleRouteClick = useCallback((routeId: string) => {
    setSelectedRoute(prev => prev === routeId ? null : routeId);
  }, []);

  const handleHazardClick = useCallback((report: HazardReport) => {
    setSelectedHazard(report);
  }, []);

  // Memoize evacuation routes to prevent recalculation
  const currentEvacuationRoutes = useMemo(() => 
    currentLocation ? evacuationRouteWaypoints.map(route => ({
      ...route,
      waypoints: [currentLocation, route.waypoints[1]] as [number, number][]
    })) : evacuationRouteWaypoints,
    [currentLocation]
  );

  // Memoize safety scores to prevent recalculation
  const routeSafetyScores = useMemo(() => {
    const scores: Record<string, number> = {};
    currentEvacuationRoutes.forEach(route => {
      scores[route.id] = 100; // Default safety score
    });
    return scores;
  }, [currentEvacuationRoutes]);

  // Calculate safety scores only when hazards change
  useEffect(() => {
    if (!currentLocation) return;

    const calculateSafety = async () => {
      const scores: Record<string, number> = {};
      
      for (const route of currentEvacuationRoutes) {
        const roadCoordinates = await fetchRoute(route.waypoints);
        scores[route.id] = calculateRouteSafety(roadCoordinates, hazardReports);
      }
      
      // Only update if scores have changed
      const hasChanged = Object.keys(scores).some(
        key => routeSafetyScores[key] !== scores[key]
      );
      
      if (hasChanged) {
        Object.assign(routeSafetyScores, scores);
      }
    };

    calculateSafety();
  }, [hazardReports.length]); // Only recalculate when hazard count changes

  // Calculate nearby safe zones based on current location
  const nearbySafeZones = useMemo(() => {
    if (!currentLocation) return [];
    
    const [userLat, userLon] = currentLocation;
    const zonesWithDistance = ALL_SAFE_ZONES.map(zone => {
      const distance = calculateDistance(
        userLat,
        userLon,
        zone.position[0],
        zone.position[1]
      );
      return { ...zone, distance };
    });

    // Sort by distance and take the 5 nearest
    return zonesWithDistance
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
  }, [currentLocation]);

  return (
    <div className="space-y-4">
      {locationError && (
        <div className="bg-warning/20 border-l-4 border-warning rounded-lg p-3">
          <p className="text-sm text-foreground">{locationError}</p>
        </div>
      )}

      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {notificationsEnabled ? (
              <Bell className="w-5 h-5 text-primary" />
            ) : (
              <BellOff className="w-5 h-5 text-muted-foreground" />
            )}
            <div>
              <h3 className="font-bold text-sm text-foreground">Hazard Alerts</h3>
              <p className="text-xs text-muted-foreground">
                {notificationsEnabled 
                  ? 'Receiving alerts for hazards within 5km' 
                  : 'Notifications disabled'}
              </p>
            </div>
          </div>
          <Button
            variant={notificationsEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setNotificationsEnabled(!notificationsEnabled);
              toast.info(
                notificationsEnabled 
                  ? 'Hazard notifications disabled' 
                  : 'Hazard notifications enabled'
              );
            }}
          >
            {notificationsEnabled ? 'Disable' : 'Enable'}
          </Button>
        </div>
      </Card>
      
      {loading || !currentLocation ? (
        <Card className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-3 text-muted-foreground">Loading map...</span>
          </div>
        </Card>
      ) : (
        <>
          <div className="relative h-[400px] rounded-lg overflow-hidden border-2 border-border shadow-lg">
            <LeafletMap 
              selectedRoute={selectedRoute} 
              hazardReports={hazardReports}
              currentLocation={currentLocation}
              evacuationRoutes={currentEvacuationRoutes}
              onHazardClick={handleHazardClick}
              nearbySafeZones={nearbySafeZones}
              routeSafetyScores={routeSafetyScores}
            />
          </div>

          {selectedHazard && (
            <Card className="p-4 border-2 border-primary">
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-bold text-lg text-foreground">Hazard Report Details</h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedHazard(null)}
                  className="h-6 w-6 p-0"
                >
                  ✕
                </Button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Badge className={cn(
                    "mb-2",
                    selectedHazard.status === 'fixed' 
                      ? "bg-success/20 text-success-foreground border-success" 
                      : "bg-warning/20 text-warning-foreground border-warning"
                  )}>
                    {selectedHazard.status === 'fixed' ? '✓ Resolved' : '⚠ Pending'}
                  </Badge>
                  <p className="font-bold text-lg text-foreground">{selectedHazard.name || selectedHazard.hazard_type}</p>
                  <p className="text-sm text-muted-foreground font-medium">Type: {selectedHazard.hazard_type}</p>
                  <p className="text-sm text-muted-foreground mt-1">{selectedHazard.description}</p>
                </div>

                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>Location:</strong> {selectedHazard.location_name || 'Unknown'}</p>
                  <p><strong>Reported:</strong> {new Date(selectedHazard.created_at).toLocaleString()}</p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <p className="text-xs font-semibold text-foreground mb-2">Original Report</p>
                    <img 
                      src={selectedHazard.image_url} 
                      alt="Hazard report" 
                      className="w-full rounded-lg border border-border object-cover max-h-48"
                    />
                  </div>

                  {selectedHazard.status === 'fixed' && selectedHazard.fix_image_url && (
                    <div>
                      <p className="text-xs font-semibold text-success mb-2">Resolution Photo</p>
                      <img 
                        src={selectedHazard.fix_image_url} 
                        alt="Fixed hazard" 
                        className="w-full rounded-lg border border-success object-cover max-h-48"
                      />
                      {selectedHazard.fix_notes && (
                        <p className="text-xs text-muted-foreground mt-2">
                          <strong>Notes:</strong> {selectedHazard.fix_notes}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        <strong>Fixed:</strong> {new Date(selectedHazard.fixed_at!).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {hazardReports.length > 0 && (
            <div className="bg-gradient-to-r from-warning/20 via-warning/10 to-warning/20 border-l-4 border-warning rounded-lg p-4 shadow-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <AlertTriangle className="w-6 h-6 text-warning animate-pulse" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-foreground text-lg mb-1">
                    ⚠️ Community Hazard Alerts
                  </h3>
                  <p className="text-sm text-foreground/90 mb-3">
                    <strong>{hazardReports.length}</strong> hazard{hazardReports.length !== 1 ? 's have' : ' has'} been reported by community members in this area
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(new Set(hazardReports.map(r => r.hazard_type))).map((type) => (
                      <Badge key={type} className="bg-warning/20 text-warning-foreground border-warning/30 font-semibold">
                        {type} ({hazardReports.filter(r => r.hazard_type === type).length})
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3 italic">
                    Stay alert and check the map above for exact locations
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}


      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Navigation className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-foreground">Evacuation Routes</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Click on a route to highlight it on the map
        </p>
        <div className="space-y-2">
          {currentEvacuationRoutes.map((route) => {
            const safetyScore = routeSafetyScores[route.id] || 100;
            const isSafest = Object.entries(routeSafetyScores).every(([id, score]) => 
              id === route.id || score <= safetyScore
            );
            
            return (
              <Button
                key={route.id}
                variant={selectedRoute === route.id ? "default" : "outline"}
                className={cn(
                  "w-full justify-start text-left h-auto py-3",
                  selectedRoute === route.id && "bg-warning text-warning-foreground hover:bg-warning/90"
                )}
                onClick={() => handleRouteClick(route.id)}
              >
                <div className="flex items-start gap-3 w-full">
                  <div
                    className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
                    style={{ backgroundColor: route.color }}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{route.name}</p>
                      {isSafest && safetyScore >= 80 && (
                        <Badge variant="outline" className="text-xs bg-success/10 text-success border-success">
                          Safest
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs opacity-80">{route.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-muted rounded-full h-1.5">
                        <div 
                          className={cn(
                            "h-1.5 rounded-full transition-all",
                            safetyScore >= 80 ? "bg-success" : safetyScore >= 50 ? "bg-warning" : "bg-critical"
                          )}
                          style={{ width: `${safetyScore}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium">{safetyScore}/100</span>
                    </div>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </Card>

      <Card className="p-4 bg-critical/5 border-critical/20">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-critical" />
          <h3 className="font-bold text-foreground">Warning</h3>
        </div>
        <p className="text-sm text-foreground/80">
          Avoid the highlighted red zone near River Road. Flooding has been reported in this area.
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="font-bold mb-3 text-foreground flex items-center gap-2">
          <MapPin className="w-5 h-5 text-success" />
          Nearest Safe Zones
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Showing 5 closest safe zones to your location
        </p>
        <div className="space-y-2">
          {nearbySafeZones.map((zone, index) => (
            <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-primary bg-primary/10 w-6 h-6 rounded-full flex items-center justify-center">
                  {index + 1}
                </span>
                <span className="text-sm text-foreground/90">{zone.name}</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {formatDistance(zone.distance)}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
