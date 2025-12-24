'use client';

import { useAuth } from '@clerk/nextjs';
import React, { useEffect, useState } from 'react';
import { useAdminLoader } from '../../AdminLoader';
import { clsx } from 'clsx';
import AdminLoginForm from './LoginForm';

export default function AdminLoginPage() {
  const { setLoading } = useAdminLoader();
  const { isSignedIn, isLoaded } = useAuth();
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
     // Если еще грузимся Clerk - ждем
     if (!isLoaded) return;

     // Если юзер уже вошел - включаем спиннер и молчим
     if (isSignedIn) {
        setLoading(true);
        return;
     }

     // Если точно НЕ вошел - показываем форму через секунду
     const timer = setTimeout(() => {
        setLoading(false);
        setTimeout(() => setFadeIn(true), 50);
     }, 1000); 
     
     return () => clearTimeout(timer);
  }, [setLoading, isSignedIn, isLoaded]);

  // Рендерим ТОЛЬКО если точно знаем, что юзера нет.
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
       <AdminLoginForm />
    </div>
  );
}

