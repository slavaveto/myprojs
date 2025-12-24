'use client';
import { ClerkProvider } from '@clerk/nextjs';

export function MyClerkProvider({ children }: { children: React.ReactNode }) {
    return (
        <ClerkProvider>
            {children}
        </ClerkProvider>
    );
}