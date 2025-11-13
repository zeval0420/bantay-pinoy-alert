import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface HazardReport {
  id: string;
  hazard_type: string;
  description: string;
  latitude: number;
  longitude: number;
  location_name: string | null;
  created_at: string;
  status: string;
}

// Vigan, Ilocos Sur coordinates
const VIGAN_CENTER: [number, number] = [17.5747, 120.3869];

// Safe zones in Vigan area
const safeZones = [
  { name: "Vigan City Hall", position: [17.5741, 120.3868] as [number, number], distance: "0.5 km" },
  { name: "Vigan Convention Center", position: [17.5720, 120.3890] as [number, number], distance: "1.2 km" },
  { name: "Bantay Church", position: [17.5920, 120.3890] as [number, number], distance: "2.8 km" },
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
  evacuationRoutes
}: { 
  selectedRoute: string | null;
  hazardReports: HazardReport[];
  currentLocation: [number, number];
  evacuationRoutes: typeof evacuationRouteWaypoints;
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

        // Add safe zone markers
        safeZones.forEach((zone) => {
          L.marker(zone.position)
            .addTo(mapInstance)
            .bindPopup(`<div class="text-sm"><p class="font-bold">${zone.name}</p><p class="text-xs">Safe Zone - ${zone.distance}</p></div>`);
        });

        // Add evacuation routes with real road-based routing
        const routePromises = evacuationRoutes.map(async (route) => {
          const roadCoordinates = await fetchRoute(route.waypoints);
          
          const polyline = L.polyline(roadCoordinates, {
            color: route.color,
            weight: 4,
            opacity: 0.7
          }).addTo(mapInstance);
          
          polyline.bindPopup(`<div class="text-sm"><p class="font-bold">${route.name}</p><p class="text-xs">${route.description}</p></div>`);
          
          // Store polyline reference
          routeLayers.current[route.id] = { polyline, defaultColor: route.color };
        });

        await Promise.all(routePromises);

        // Add hazard report markers
        hazardReports.forEach((report) => {
          const hazardIcon = L.divIcon({
            className: 'custom-hazard-icon',
            html: `<div style="background-color: #DC2626; color: white; border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">!</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
          });

          const marker = L.marker([report.latitude, report.longitude], { icon: hazardIcon })
            .addTo(mapInstance)
            .bindPopup(`
              <div class="text-sm max-w-xs">
                <p class="font-bold text-base mb-1">${report.hazard_type}</p>
                <p class="text-xs text-gray-600 mb-2">${report.description}</p>
                <p class="text-xs text-gray-500 mb-1">
                  <strong>Location:</strong> ${report.location_name || 'Unknown'}
                </p>
                <p class="text-xs text-gray-500">
                  <strong>Reported:</strong> ${new Date(report.created_at).toLocaleString()}
                </p>
                <span class="inline-block mt-2 px-2 py-1 text-xs rounded ${
                  report.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                  report.status === 'verified' ? 'bg-green-100 text-green-800' :
                  'bg-gray-100 text-gray-800'
                }">${report.status}</span>
              </div>
            `);

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
}, [hazardReports, currentLocation, evacuationRoutes]);

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

  // Get user's current location
  useEffect(() => {
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

  // Fetch hazard reports
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
  }, []);

  const fetchHazardReports = async () => {
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
  };

  const handleRouteClick = (routeId: string) => {
    setSelectedRoute(selectedRoute === routeId ? null : routeId);
  };

  // Calculate routes from current location
  const currentEvacuationRoutes = currentLocation ? evacuationRouteWaypoints.map(route => ({
    ...route,
    waypoints: [currentLocation, route.waypoints[1]] as [number, number][]
  })) : evacuationRouteWaypoints;

  return (
    <div className="space-y-4">
      {locationError && (
        <div className="bg-warning/20 border-l-4 border-warning rounded-lg p-3">
          <p className="text-sm text-foreground">{locationError}</p>
        </div>
      )}
      
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
            />
          </div>

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
          {currentEvacuationRoutes.map((route) => (
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
                  <p className="font-semibold text-sm">{route.name}</p>
                  <p className="text-xs opacity-80">{route.description}</p>
                </div>
              </div>
            </Button>
          ))}
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
          Safe Zones in Vigan Area
        </h3>
        <div className="space-y-2">
          {safeZones.map((zone, index) => (
            <div key={index} className="flex items-center justify-between">
              <span className="text-sm text-foreground/90">{zone.name}</span>
              <Badge variant="outline" className="text-xs">
                {zone.distance}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
