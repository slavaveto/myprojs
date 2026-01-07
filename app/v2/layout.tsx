import React from 'react';
import { PowerSyncProvider } from '@/app/_services/powerSync/PowerSyncProvider';

export default function V2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PowerSyncProvider>
        <div className="min-h-screen bg-white text-black font-sans antialiased">
        {/* V2 Reset: No old providers, just clean layout */}
        {children}
        </div>
    </PowerSyncProvider>
  );
}

