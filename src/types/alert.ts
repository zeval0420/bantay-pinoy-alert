export type AlertSeverity = 'critical' | 'warning' | 'advisory';
export type DisasterType = 'typhoon' | 'earthquake' | 'flood' | 'tsunami' | 'volcanic' | 'landslide';

export interface Alert {
  id: string;
  title: string;
  severity: AlertSeverity;
  type: DisasterType;
  description: string;
  location: string;
  time: Date;
  evacuationRoute?: string;
  safeZones?: string[];
  instructions: string[];
}
