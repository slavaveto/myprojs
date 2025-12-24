'use client';

import { useAuth } from '@clerk/nextjs';
import React, { useEffect, useState } from 'react';
import { useAdminLoader } from '../../AdminLoader';
import { clsx } from 'clsx';
import AdminSignUpForm from './SignUpForm';

export default function AdminSignUpPage() {
  const { setLoading } = useAdminLoader();
  const { isSignedIn, isLoaded } = useAuth();
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
     if (!isLoaded) return;

     if (isSignedIn) {
        setLoading(true);
        return;
     }

     const timer = setTimeout(() => {
        setLoading(false);
        setTimeout(() => setFadeIn(true), 50);
     }, 1000); 
     
     return () => clearTimeout(timer);
  }, [setLoading, isSignedIn, isLoaded]);

  if (!isLoaded || isSignedIn) {
      return null;
  }

  return (
    <div 
       className={clsx(
          "flex flex-col items-center justify-center min-h-screen bg-content1 p-4 transition-opacity duration-700",
          fadeIn ? "opacity-100" : "opacity-0"
       )}
    >
       <AdminSignUpForm />
    </div>
  );
}

