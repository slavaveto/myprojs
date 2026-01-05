'use client';

import React, { useEffect, useState } from 'react';
import { Chip } from "@heroui/react";
import { RefreshCw, CheckCircle2, Loader2 } from "lucide-react";
import { useRxDB } from '@/services/rxdb/RxDBProvider';
import { StatusBadge, StatusBadgeProps } from './StatusBadge';

export const RxStatusBadge = (props: StatusBadgeProps) => {
  // Safe context access
  let isSyncing = false;
  let lastStats = { sent: 0, received: 0 };
  try {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const rxContext = useRxDB() as any; 
      isSyncing = rxContext?.isSyncing;
      lastStats = rxContext?.lastSyncStats || { sent: 0, received: 0 };
  } catch (e) {
      // Ignore error if outside provider
  }

  const [visualState, setVisualState] = useState<'idle' | 'syncing' | 'done'>('idle');

  // Watch for sync start
  useEffect(() => {
      if (isSyncing) {
          setVisualState('syncing');
      }
  }, [isSyncing]);

  // Watch for sync end to handle transitions
  useEffect(() => {
      let timeout: NodeJS.Timeout;

      if (visualState === 'syncing' && !isSyncing) {
          // Keep showing "Syncing..." for at least 600ms
          timeout = setTimeout(() => setVisualState('done'), 600);
      } else if (visualState === 'done') {
          // Show "Synced" for 2500ms then go idle
          timeout = setTimeout(() => setVisualState('idle'), 1500);
      }

      return () => clearTimeout(timeout);
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
      const hasActivity = lastStats.sent > 0 || lastStats.received > 0;

      return (
        <div className={`relative flex flex-col items-center ${props.className}`}>
            <Chip 
                startContent={<CheckCircle2 size={16} />} 
                color="success" 
                variant="flat" 
                size="md" 
                className="px-2"
            >
                Synced
            </Chip>
            
            {/* Auto-Popover for stats */}
            {hasActivity && (
                <div className="absolute top-full right-0 mt-2 p-2 bg-content1 shadow-lg rounded-lg z-50 min-w-[140px] border border-default-200 text-xs animate-in fade-in slide-in-from-top-2 bg-white dark:bg-zinc-800">
                    <div className="font-semibold mb-1 text-default-600 border-b border-default-100 pb-1">Sync Details</div>
                    <div className="flex justify-between gap-2">
                        <span className="text-default-500">Received:</span>
                        <span className="font-mono">{lastStats.received}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                        <span className="text-default-500">Sent:</span>
                        <span className="font-mono">{lastStats.sent}</span>
                    </div>
                </div>
            )}
        </div>
      );
  }

  // Fallback
  return <StatusBadge {...props} />;
};
