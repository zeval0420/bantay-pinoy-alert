import { Alert } from "@/types/alert";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, AlertTriangle, Waves, Mountain, Cloud } from "lucide-react";
import { cn } from "@/lib/utils";

interface AlertCardProps {
  alert: Alert;
  onClick: () => void;
}

const severityStyles = {
  critical: "bg-critical/10 border-critical text-critical-foreground alert-pulse",
  warning: "bg-warning/10 border-warning text-warning-foreground",
  advisory: "bg-muted border-border",
};

const disasterIcons = {
  typhoon: Cloud,
  earthquake: Mountain,
  flood: Waves,
  tsunami: Waves,
  volcanic: Mountain,
  landslide: Mountain,
};

export const AlertCard = ({ alert, onClick }: AlertCardProps) => {
  const Icon = disasterIcons[alert.type];
  
  return (
    <Card
      onClick={onClick}
      className={cn(
        "p-4 cursor-pointer transition-all hover:shadow-lg border-2",
        severityStyles[alert.severity],
        "slide-up"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "p-2 rounded-lg",
          alert.severity === 'critical' && "bg-critical text-critical-foreground",
          alert.severity === 'warning' && "bg-warning text-warning-foreground",
          alert.severity === 'advisory' && "bg-muted-foreground text-background"
        )}>
          <Icon className="w-5 h-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
              {alert.severity.toUpperCase()}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {alert.type}
            </Badge>
          </div>
          
          <h3 className="font-bold text-lg mb-2 text-foreground">{alert.title}</h3>
          
          <p className="text-sm text-foreground/80 mb-3 line-clamp-2">
            {alert.description}
          </p>
          
          <div className="flex flex-col gap-1 text-xs text-foreground/70">
            <div className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span>{alert.location}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>{alert.time.toLocaleString('en-PH')}</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
