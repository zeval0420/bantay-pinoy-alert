import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Hospital, Shield, Radio, AlertCircle } from "lucide-react";

const contacts = [
  {
    name: "National Emergency Hotline",
    number: "911",
    icon: AlertCircle,
    color: "text-critical",
  },
  {
    name: "NDRRMC",
    number: "(02) 8911-1406",
    icon: Shield,
    color: "text-primary",
  },
  {
    name: "Philippine Red Cross",
    number: "143",
    icon: Hospital,
    color: "text-warning",
  },
  {
    name: "PAGASA Weather",
    number: "(02) 8927-1335",
    icon: Radio,
    color: "text-accent",
  },
  {
    name: "PNP Emergency",
    number: "117",
    icon: Shield,
    color: "text-primary",
  },
  {
    name: "BFP Fire Emergency",
    number: "160",
    icon: AlertCircle,
    color: "text-critical",
  },
];

export const EmergencyContacts = () => {
  const handleCall = (number: string) => {
    window.location.href = `tel:${number}`;
  };

  return (
    <div className="space-y-4">
      <div className="bg-critical/10 border border-critical/20 rounded-lg p-4">
        <h2 className="font-bold text-lg text-foreground mb-2 flex items-center gap-2">
          <Phone className="w-5 h-5" />
          Emergency Contacts
        </h2>
        <p className="text-sm text-foreground/80">
          Save these numbers. In case of emergency, call immediately.
        </p>
      </div>

      <div className="grid gap-3">
        {contacts.map((contact) => {
          const Icon = contact.icon;
          return (
            <Card key={contact.number} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-muted ${contact.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{contact.name}</p>
                    <p className="text-sm text-muted-foreground">{contact.number}</p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleCall(contact.number)}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <Phone className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-4 bg-muted/50">
        <h3 className="font-bold mb-2 text-foreground">Local Government Unit</h3>
        <p className="text-sm text-muted-foreground mb-3">
          Contact your barangay or municipal office for local emergency assistance.
        </p>
        <Button variant="outline" className="w-full">
          <Phone className="w-4 h-4 mr-2" />
          Find Local Emergency Contacts
        </Button>
      </Card>
    </div>
  );
};
