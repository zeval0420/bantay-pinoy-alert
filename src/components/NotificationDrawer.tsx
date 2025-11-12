import { Alert } from "@/types/alert";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  alerts: Alert[];
  onAlertClick: (alert: Alert) => void;
}

export const NotificationDrawer = ({ isOpen, onClose, alerts, onAlertClick }: NotificationDrawerProps) => {
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');
  const advisoryAlerts = alerts.filter(a => a.severity === 'advisory');

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-primary" />
            Notifications ({alerts.length})
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
          <div className="space-y-4">
            {criticalAlerts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-critical mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-critical rounded-full animate-pulse" />
                  Critical Alerts ({criticalAlerts.length})
                </h3>
                <div className="space-y-2">
                  {criticalAlerts.map((alert) => (
                    <NotificationItem
                      key={alert.id}
                      alert={alert}
                      onClick={() => {
                        onAlertClick(alert);
                        onClose();
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {warningAlerts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-warning mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-warning rounded-full" />
                  Warnings ({warningAlerts.length})
                </h3>
                <div className="space-y-2">
                  {warningAlerts.map((alert) => (
                    <NotificationItem
                      key={alert.id}
                      alert={alert}
                      onClick={() => {
                        onAlertClick(alert);
                        onClose();
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {advisoryAlerts.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                  <div className="w-2 h-2 bg-muted-foreground rounded-full" />
                  Advisories ({advisoryAlerts.length})
                </h3>
                <div className="space-y-2">
                  {advisoryAlerts.map((alert) => (
                    <NotificationItem
                      key={alert.id}
                      alert={alert}
                      onClick={() => {
                        onAlertClick(alert);
                        onClose();
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {alerts.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <p>No active alerts</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};

const NotificationItem = ({ alert, onClick }: { alert: Alert; onClick: () => void }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-lg border-2 transition-all hover:shadow-md",
        alert.severity === 'critical' && "bg-critical/10 border-critical/20",
        alert.severity === 'warning' && "bg-warning/10 border-warning/20",
        alert.severity === 'advisory' && "bg-muted/50 border-border"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <Badge
          variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}
          className="text-xs"
        >
          {alert.type}
        </Badge>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {new Date(alert.time).toLocaleTimeString('en-PH', { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </span>
      </div>
      <p className="font-semibold text-sm mb-1 text-foreground">{alert.title}</p>
      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <MapPin className="w-3 h-3" />
        {alert.location}
      </p>
    </button>
  );
};
