import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import { Package, Home, Heart, Zap } from "lucide-react";

const checklistItems = [
  {
    category: "Emergency Kit",
    icon: Package,
    items: [
      "Drinking water (3 days supply)",
      "Non-perishable food",
      "First aid kit",
      "Flashlight and batteries",
      "Portable radio",
      "Emergency blankets",
    ],
  },
  {
    category: "Important Documents",
    icon: Home,
    items: [
      "Identification papers",
      "Insurance documents",
      "Medical records",
      "Property documents",
      "Emergency contact list",
    ],
  },
  {
    category: "Personal Items",
    icon: Heart,
    items: [
      "Medications",
      "Extra clothing",
      "Personal hygiene items",
      "Cash and credit cards",
      "Mobile phone charger",
    ],
  },
  {
    category: "Safety Measures",
    icon: Zap,
    items: [
      "Know evacuation routes",
      "Identify safe zones",
      "Secure loose items outdoors",
      "Turn off utilities if needed",
      "Inform family members of plan",
    ],
  },
];

export const Checklist = () => {
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const handleCheck = (id: string) => {
    setChecked((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-4">
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
        <h2 className="font-bold text-lg text-foreground mb-2">Emergency Preparedness</h2>
        <p className="text-sm text-foreground/80">
          Check off items as you prepare. Being ready can save lives during emergencies.
        </p>
      </div>

      {checklistItems.map((section) => {
        const Icon = section.icon;
        const sectionChecked = section.items.filter(
          (item) => checked[`${section.category}-${item}`]
        ).length;
        const total = section.items.length;

        return (
          <Card key={section.category} className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Icon className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-foreground">{section.category}</h3>
              </div>
              <span className="text-sm text-muted-foreground">
                {sectionChecked}/{total}
              </span>
            </div>
            <div className="space-y-3">
              {section.items.map((item) => {
                const id = `${section.category}-${item}`;
                return (
                  <div key={id} className="flex items-center gap-3">
                    <Checkbox
                      id={id}
                      checked={checked[id] || false}
                      onCheckedChange={() => handleCheck(id)}
                    />
                    <label
                      htmlFor={id}
                      className="text-sm text-foreground/90 cursor-pointer flex-1"
                    >
                      {item}
                    </label>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
};
