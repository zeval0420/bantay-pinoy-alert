import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { calculateDistance } from '@/lib/geolocation';

interface HazardReport {
  id: string;
  name: string | null;
  hazard_type: string;
  description: string;
  latitude: number;
  longitude: number;
  location_name: string | null;
  status: string;
  created_at: string;
  fixed_at: string | null;
}

const NOTIFICATION_RADIUS_KM = 5; // Alert for hazards within 5km

export const useHazardNotifications = (
  currentLocation: [number, number] | null,
  enabled: boolean = true
) => {
  const processedHazards = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentLocation || !enabled) return;

    const [userLat, userLon] = currentLocation;

    const channel = supabase
      .channel('hazard-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'hazard_reports',
        },
        (payload) => {
          const newHazard = payload.new as HazardReport;
          
          if (processedHazards.current.has(newHazard.id)) return;
          processedHazards.current.add(newHazard.id);

          const distance = calculateDistance(
            userLat,
            userLon,
            newHazard.latitude,
            newHazard.longitude
          );

          if (distance <= NOTIFICATION_RADIUS_KM) {
            toast.warning(
              `New hazard reported ${distance.toFixed(1)}km from your location`,
              {
                description: `${newHazard.name || newHazard.hazard_type} - ${newHazard.description.substring(0, 80)}${newHazard.description.length > 80 ? '...' : ''}`,
                duration: 8000,
              }
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'hazard_reports',
        },
        (payload) => {
          const oldHazard = payload.old as HazardReport;
          const updatedHazard = payload.new as HazardReport;

          // Check if status changed to fixed
          if (oldHazard.status !== 'fixed' && updatedHazard.status === 'fixed') {
            const distance = calculateDistance(
              userLat,
              userLon,
              updatedHazard.latitude,
              updatedHazard.longitude
            );

            if (distance <= NOTIFICATION_RADIUS_KM) {
              toast.success(
                `Hazard resolved ${distance.toFixed(1)}km from your location`,
                {
                  description: `${updatedHazard.hazard_type} has been fixed by authorities`,
                  duration: 6000,
                }
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentLocation, enabled]);
};
