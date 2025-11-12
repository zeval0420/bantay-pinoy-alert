import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation } from "lucide-react";

export const MapView = () => {
  return (
    <div className="space-y-4">
      <div className="relative h-[400px] bg-muted rounded-lg overflow-hidden border-2 border-border">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-2">
            <MapPin className="w-12 h-12 text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Interactive map view</p>
          </div>
        </div>
        
        {/* Simulated map markers */}
        <div className="absolute top-1/4 left-1/3 w-4 h-4 bg-success rounded-full border-2 border-background shadow-lg animate-pulse" />
        <div className="absolute top-1/3 right-1/4 w-4 h-4 bg-success rounded-full border-2 border-background shadow-lg animate-pulse" />
        <div className="absolute bottom-1/3 left-1/2 w-4 h-4 bg-critical rounded-full border-2 border-background shadow-lg alert-pulse" />
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Navigation className="w-5 h-5 text-primary" />
          <h3 className="font-bold text-foreground">Evacuation Routes</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 bg-success rounded-full mt-1.5" />
            <div>
              <p className="font-semibold text-sm text-foreground">Route A: Coastal Highway</p>
              <p className="text-xs text-muted-foreground">Clear - Recommended</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 bg-success rounded-full mt-1.5" />
            <div>
              <p className="font-semibold text-sm text-foreground">Route B: Mountain Pass</p>
              <p className="text-xs text-muted-foreground">Clear - Alternative route</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-3 h-3 bg-critical rounded-full mt-1.5" />
            <div>
              <p className="font-semibold text-sm text-foreground">Route C: River Road</p>
              <p className="text-xs text-muted-foreground">Closed - Flooding reported</p>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-bold mb-3 text-foreground">Safe Zones Nearby</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground/90">Barangay Hall</span>
            <Badge variant="outline" className="text-xs">2.3 km</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground/90">Community Center</span>
            <Badge variant="outline" className="text-xs">3.1 km</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-foreground/90">Municipal Gym</span>
            <Badge variant="outline" className="text-xs">4.5 km</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
};
