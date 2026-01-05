'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Chip } from "@heroui/react";
import { RefreshCw, CheckCircle2 } from "lucide-react";
import { useRxDB } from '@/services/rxdb/RxDBProvider';
import { StatusBadge, StatusBadgeProps } from './StatusBadge';

export const RxStatusBadge = (props: StatusBadgeProps) => {
  // Safe context access
  let isSyncing = false;
  try {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const rxContext = useRxDB() as any; 
      isSyncing = rxContext?.isSyncing;
  } catch (e) {
      // Ignore error if outside provider
  }

  const [isVisuallySyncing, setIsVisuallySyncing] = useState(isSyncing);
  const [showDone, setShowDone] = useState(false);
  const hasSyncedRef = useRef(false);

  useEffect(() => {
      let timeout: NodeJS.Timeout;
      
      if (isSyncing) {
          hasSyncedRef.current = true;
          setIsVisuallySyncing(true);
          setShowDone(false);
      } else {
          // Only trigger transition logic if we were syncing previously in this session
          if (hasSyncedRef.current && isVisuallySyncing) {
              timeout = setTimeout(() => {
                  setIsVisuallySyncing(false);
                  setShowDone(true);
                  
                  // Hide "Synced" after 2 seconds
                  setTimeout(() => {
                      setShowDone(false);
                      hasSyncedRef.current = false; // Reset? Or keep true? Keep true doesn't hurt.
                  }, 1000);
              }, 600); // Minimum 600ms sync visibility
          }
      }
      return () => clearTimeout(timeout);
  }, [isSyncing, isVisuallySyncing]);

  // If syncing -> Blue badge (Prioritized)
  if (isVisuallySyncing) {
    return (
        <div className={props.className}>
            <Chip 
                startContent={<RefreshCw className="animate-spin" size={14} />} 
                color="primary" 
                variant="flat" 
                size="md" 
                className="px-2"
            >
                Syncing...
            </Chip>
        </div>
    );
  }

  // If just finished syncing -> Green Synced (Prioritized)
  if (showDone) {
      return (
        <div className={props.className}>
            <Chip 
                startContent={<CheckCircle2 size={16} />} 
                color="success" 
                variant="flat" 
                size="md" 
                className="px-2"
            >
                Synced
            </Chip>
        </div>
      );
  }

  // Otherwise -> Fallback to original StatusBadge logic (which now handles suppressLoading)
  return <StatusBadge {...props} />;
};
