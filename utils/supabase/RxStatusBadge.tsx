'use client';

import React, { useEffect, useState } from 'react';
import { Chip } from "@heroui/react";
import { RefreshCw, CheckCircle2, Loader2 } from "lucide-react";
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

  const [visualState, setVisualState] = useState<'idle' | 'syncing' | 'done'>('idle');

  // Watch for sync start
  useEffect(() => {
      // console.log('RxStatusBadge: isSyncing:', isSyncing, 'visualState:', visualState);
      if (isSyncing) {
          setVisualState('syncing');
      }
  }, [isSyncing]);

  // Watch for sync end to handle transitions
  useEffect(() => {
      let t1: NodeJS.Timeout;
      let t2: NodeJS.Timeout;

      if (!isSyncing && visualState === 'syncing') {
          // Keep showing "Syncing..." for at least 600ms
          t1 = setTimeout(() => {
              setVisualState('done');
              
              // Show "Synced" for 1000ms then go idle
              t2 = setTimeout(() => {
                  setVisualState('idle');
              }, 1000);
          }, 600);
      }

      return () => {
          clearTimeout(t1);
          clearTimeout(t2);
      };
  }, [isSyncing, visualState]);

  // If syncing (real or visual hold) -> Blue badge
  if (visualState === 'syncing') {
    return (
        <div className={props.className}>
            <Chip 
                startContent={<RefreshCw className="animate-spin" size={14} />} 
                className="px-2 bg-blue-600 text-white border-none"
                variant="solid" 
                size="md" 
            >
                Syncing...
            </Chip>
        </div>
    );
  }

  // If done -> Green Synced
  if (visualState === 'done') {
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

  // Fallback
  return <StatusBadge {...props} />;
};
