import React from 'react';
import { ProviderV3 } from '@/app/_services_v3/Provider';

export default function V3Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProviderV3>
        <div className="min-h-screen bg-white text-black font-sans antialiased">
            {children}
        </div>
    </ProviderV3>
  );
}
