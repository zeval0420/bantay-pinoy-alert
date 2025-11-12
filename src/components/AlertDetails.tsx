import { Alert } from "@/types/alert";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertDetailsProps {
  alert: Alert;
  onBack: () => void;
}

export const AlertDetails = ({ alert, onBack }: AlertDetailsProps) => {
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="container max-w-2xl mx-auto p-4">
          <Button
            variant="ghost"
            onClick={onBack}
            className="mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Alerts
          </Button>
        </div>
      </div>

      <div className="container max-w-2xl mx-auto p-4 space-y-4">
        <Card className={cn(
          "p-6 border-2",
          alert.severity === 'critical' && "border-critical bg-critical/5",
          alert.severity === 'warning' && "border-warning bg-warning/5",
          alert.severity === 'advisory' && "border-border"
        )}>
          <div className="flex items-center gap-2 mb-4">
            <Badge 
              variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}
              className="text-sm"
            >
              {alert.severity.toUpperCase()}
            </Badge>
            <Badge variant="outline" className="text-sm">
              {alert.type}
            </Badge>
          </div>

          <h1 className="text-2xl font-bold mb-4 text-foreground">{alert.title}</h1>

          <div className="space-y-3 mb-6">
            <div className="flex items-start gap-2 text-foreground/80">
              <MapPin className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Location</p>
                <p className="text-sm">{alert.location}</p>
              </div>
            </div>

            <div className="flex items-start gap-2 text-foreground/80">
              <Clock className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold">Time</p>
                <p className="text-sm">{alert.time.toLocaleString('en-PH')}</p>
              </div>
            </div>
          </div>

          <div className="prose prose-sm max-w-none">
            <p className="text-foreground/90">{alert.description}</p>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <h2 className="text-xl font-bold text-foreground">Safety Instructions</h2>
          </div>
          <ul className="space-y-3">
            {alert.instructions.map((instruction, index) => (
              <li key={index} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-success mt-0.5 flex-shrink-0" />
                <span className="text-foreground/90">{instruction}</span>
              </li>
            ))}
          </ul>
        </Card>

        {alert.safeZones && alert.safeZones.length > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4 text-foreground flex items-center gap-2">
              <MapPin className="w-5 h-5 text-success" />
              Safe Zones
            </h2>
            <ul className="space-y-2">
              {alert.safeZones.map((zone, index) => (
                <li key={index} className="flex items-center gap-2 text-foreground/90">
                  <div className="w-2 h-2 bg-success rounded-full" />
                  {zone}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Button 
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          size="lg"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          View Evacuation Map
        </Button>
      </div>
    </div>
  );
};
