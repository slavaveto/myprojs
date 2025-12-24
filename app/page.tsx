"use client";

import React, { useState, useEffect } from 'react';
import { ProjectDataProvider, useProjectData } from '@/app/providers/ProjectDataProvider';
import { GlobalLoadingSpinner } from '@/app/components/GlobalLoadingSpinner';
// import { useLocalization } from '@/app/utils/providers/localization/LocalizationProvider'; 

// --- Вспомогательные компоненты внутри одного файла ---

function LandingContent({ onReady }: { onReady: () => void }) {
    useEffect(() => {
        // Имитация инициализации лендинга
        onReady();
    }, [onReady]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-24">
            <h1 className="text-4xl font-bold">SaaS Boilerplate</h1>
            <p className="mt-4 text-xl">Landing Page</p>
            <div className="mt-8 p-4 bg-default-100 rounded">
                <p className="text-sm">Попробуйте зайти на <code>sub.localhost:3000</code> или <code>admin.localhost:3000</code></p>
            </div>
        </div>
    );
}

function ProjectContent({ subdomain, onReady }: { subdomain: string, onReady: () => void }) {
   const { isLoading, projectData, error } = useProjectData();
   
   useEffect(() => {
      if (!isLoading && (projectData || error)) {
         onReady();
      }
   }, [isLoading, projectData, error, onReady]);

   if (error) {
      return (
         <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background text-foreground">
            <h1 className="text-2xl font-bold">Проект не найден</h1>
            <p className="text-default-500">Субдомен: {subdomain}</p>
            <p className="text-danger">{error.message}</p>
         </div>
      );
   }

   if (!projectData && !isLoading) return null;

   return (
      <div className="container mx-auto p-8">
            <h1 className="text-4xl font-bold mb-4">{projectData?.title}</h1>
            <p className="text-xl text-default-600">Добро пожаловать в проект!</p>
            <div className="mt-8 p-4 border rounded-lg bg-content1">
                <pre className="text-xs">{JSON.stringify(projectData, null, 2)}</pre>
            </div>
      </div>
   );
}

// --- Основной компонент страницы ---

export default function Page() {
   const [subdomain, setSubdomain] = useState<string | null>(null);
   const [isCheckingDomain, setIsCheckingDomain] = useState(true);
   
   // Состояния для спиннера
   const [isAppReady, setIsAppReady] = useState(false);
   const [showContent, setShowContent] = useState(false);
   const isUILoaded = true; // Заглушка

   useEffect(() => {
      // Логика определения субдомена на клиенте
      const hostname = window.location.hostname;
      const domainParts = hostname.split('.');
      const isLocalhost = hostname.includes('localhost');

      let foundSubdomain = '';

      if (isLocalhost) {
          // sub.localhost
          if (domainParts.length > 1 && domainParts[0] !== 'www' && domainParts[0] !== 'admin') {
              foundSubdomain = domainParts[0];
          }
      } else {
          // sub.domain.com
          if (domainParts.length > 2 && domainParts[0] !== 'www' && domainParts[0] !== 'admin') {
              foundSubdomain = domainParts[0];
          }
      }

      setSubdomain(foundSubdomain || null);
      setIsCheckingDomain(false);
   }, []);

   const handleContentReady = () => {
       // Небольшая задержка для плавности
       setTimeout(() => setIsAppReady(true), 500);
   };

   // Пока определяем домен - можно ничего не показывать или спиннер
   // Но GlobalLoadingSpinner требует isPageDataLoading, так что мы можем управлять им
   
   // isPageDataLoading для спиннера:
   // true, пока проверяем домен.
   // Если есть субдомен -> ProjectDataProvider сам будет управлять своим loading внутри, 
   // но нам нужно прокинуть это состояние наверх.
   // В текущей архитектуре ProjectDataProvider внутри ProjectContent.
   
   // Упростим: Спиннер всегда висит, пока isAppReady = false.
   // isAppReady становится true, когда дочерний компонент вызывает handleContentReady.

   return (
      <>
         <GlobalLoadingSpinner 
            isPageDataLoading={isCheckingDomain} 
            isAppReady={isAppReady}
            isUILoaded={isUILoaded}
            onFadeOutComplete={() => setShowContent(true)}
         />

         <div className={`min-h-screen transition-opacity duration-500 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
             {!isCheckingDomain && (
                 subdomain ? (
                     <ProjectDataProvider subdomain={subdomain}>
                         <ProjectContent subdomain={subdomain} onReady={handleContentReady} />
                     </ProjectDataProvider>
                 ) : (
                     <LandingContent onReady={handleContentReady} />
                 )
             )}
         </div>
      </>
   );
}
