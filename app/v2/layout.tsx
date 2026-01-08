import React from 'react';
import { SyncProvider } from '@/app/_services/powerSync/SyncProvider';

export default function V2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SyncProvider>
        <div className="min-h-screen bg-white text-black font-sans antialiased">
        {/* V2 Reset: No old providers, just clean layout */}
        {children}
        </div>
    </SyncProvider>
  );
}

