"use client";

import React, { useState, useEffect } from 'react';
import { ProjectDataProvider, useProjectData } from '@/app/providers/ProjectDataProvider';
import { GlobalLoadingSpinner } from '@/app/components/GlobalLoadingSpinner';

// --- Client Components (UI) ---

function LandingContent({ onReady }: { onReady: () => void }) {
    useEffect(() => {
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

// --- Main Client Wrapper ---

export default function MainClientWrapper({ 
    subdomain,
    isLanding
}: { 
    subdomain: string | null,
    isLanding: boolean 
}) {
   const [isAppReady, setIsAppReady] = useState(false);
   const [showContent, setShowContent] = useState(false);
   const isUILoaded = true; // Заглушка

   const handleContentReady = () => {
       setTimeout(() => setIsAppReady(true), 500);
   };

   return (
      <>
         <GlobalLoadingSpinner 
            isPageDataLoading={false} // Управляем через isAppReady
            isAppReady={isAppReady}
            isUILoaded={isUILoaded}
            onFadeOutComplete={() => setShowContent(true)}
         />

         <div className={`min-h-screen transition-opacity duration-500 ${showContent ? 'opacity-100' : 'opacity-0'}`}>
             {!isLanding && subdomain ? (
                 <ProjectDataProvider subdomain={subdomain}>
                     <ProjectContent subdomain={subdomain} onReady={handleContentReady} />
                 </ProjectDataProvider>
             ) : (
                 <LandingContent onReady={handleContentReady} />
             )}
         </div>
      </>
   );
}

