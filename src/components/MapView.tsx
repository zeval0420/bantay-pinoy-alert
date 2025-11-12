import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// Vigan, Ilocos Sur coordinates
const VIGAN_CENTER: [number, number] = [17.5747, 120.3869];

// Safe zones in Vigan area
const safeZones = [
  { name: "Vigan City Hall", position: [17.5741, 120.3868] as [number, number], distance: "0.5 km" },
  { name: "Vigan Convention Center", position: [17.5720, 120.3890] as [number, number], distance: "1.2 km" },
  { name: "Bantay Church", position: [17.5920, 120.3890] as [number, number], distance: "2.8 km" },
];

// Evacuation routes
const evacuationRoutes = [
  {
    id: "route-a",
    name: "Coastal Highway Route",
    status: "clear",
    description: "Clear - Recommended",
    coordinates: [
      [17.5747, 120.3869] as [number, number],
      [17.5800, 120.3900] as [number, number],
      [17.5850, 120.3950] as [number, number],
      [17.5920, 120.3890] as [number, number],
    ],
    color: "#10B981",
  },
  {
    id: "route-b",
    name: "Heritage Village Route",
    status: "clear",
    description: "Clear - Alternative route",
    coordinates: [
      [17.5747, 120.3869] as [number, number],
      [17.5750, 120.3850] as [number, number],
      [17.5780, 120.3820] as [number, number],
      [17.5741, 120.3868] as [number, number],
    ],
    color: "#10B981",
  },
  {
    id: "route-c",
    name: "River Road",
    status: "closed",
    description: "Closed - Flooding reported",
    coordinates: [
      [17.5747, 120.3869] as [number, number],
      [17.5700, 120.3850] as [number, number],
      [17.5650, 120.3830] as [number, number],
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

// Leaflet Map Component
const LeafletMap = () => {
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    // Dynamically import Leaflet to avoid SSR issues
    import('leaflet').then((L) => {
      // Fix default marker icon issue
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      });

      // Import CSS
      import('leaflet/dist/leaflet.css').then(() => {
        setMapLoaded(true);
      });
    });
  }, []);

  useEffect(() => {
    if (!mapLoaded) return;

    const L = require('leaflet');
    
    // Create map
    const map = L.map('map').setView(VIGAN_CENTER, 13);

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Add danger zone circle
    L.circle(dangerZone.center, {
      color: '#DC2626',
      fillColor: '#DC2626',
      fillOpacity: 0.2,
      radius: dangerZone.radius
    }).addTo(map).bindPopup('<div class="text-sm"><p class="font-bold">Danger Zone</p><p>Flooding reported in this area</p></div>');

    // Add safe zone markers
    safeZones.forEach((zone) => {
      L.marker(zone.position)
        .addTo(map)
        .bindPopup(`<div class="text-sm"><p class="font-bold">${zone.name}</p><p class="text-xs">Safe Zone - ${zone.distance}</p></div>`);
    });

    // Add evacuation routes
    evacuationRoutes.forEach((route) => {
      const polyline = L.polyline(route.coordinates, {
        color: route.color,
        weight: 4,
        opacity: 0.7
      }).addTo(map);
      
      polyline.bindPopup(`<div class="text-sm"><p class="font-bold">${route.name}</p><p class="text-xs">${route.description}</p></div>`);
      
      // Store polyline for later highlighting
      (polyline as any).routeId = route.id;
    });

    // Cleanup
    return () => {
      map.remove();
    };
  }, [mapLoaded]);

  if (!mapLoaded) {
    return (
      <div className="h-full w-full bg-muted flex items-center justify-center">
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  return <div id="map" className="h-full w-full" />;
};

export const MapView = () => {
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  const handleRouteClick = (routeId: string) => {
    setSelectedRoute(selectedRoute === routeId ? null : routeId);
    
    // Highlight route on map
    if (typeof window !== 'undefined' && (window as any).L) {
      const L = (window as any).L;
      const map = (document.getElementById('map') as any)?._leaflet_map;
      
      if (map) {
        map.eachLayer((layer: any) => {
          if (layer.routeId) {
            if (layer.routeId === routeId && selectedRoute !== routeId) {
              layer.setStyle({ color: '#F59E0B', weight: 6, opacity: 1 });
            } else {
              const route = evacuationRoutes.find(r => r.id === layer.routeId);
              if (route) {
                layer.setStyle({ color: route.color, weight: 4, opacity: 0.7 });
              }
            }
          }
        });
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative h-[400px] rounded-lg overflow-hidden border-2 border-border shadow-lg">
        <LeafletMap />
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Navigation className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-foreground">Evacuation Routes</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Click on a route to highlight it on the map
        </p>
        <div className="space-y-2">
          {evacuationRoutes.map((route) => (
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
