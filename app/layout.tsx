import { Montserrat } from 'next/font/google';
import type { Metadata } from 'next';
import '@/app/globals.css';
import { HeroUiProvider } from '@/utils/providers/HeroUIProvider';
import { themeScript } from '@/utils/providers/themeScript';
import { DeviceProvider } from '@/utils/providers/MobileDetect';
import { ThemeProvider } from '@/utils/providers/ThemeProvider';
import { MyClerkProvider } from '@/utils/providers/ClerkProvider';
import { Toaster } from 'react-hot-toast';
import { headers } from 'next/headers';
import { supabase } from '@/utils/supabase/supabaseClient';
import { LocalizationProvider } from '@/utils/providers/localization/LocalizationProvider';
import GlobalToggles from '@/utils/providers/GlobalToggles';
import clsx from 'clsx';
import { DebugPanel } from '@/utils/logger/DebugPanel';
import { DeviceFrame } from '@/utils/providers/DeviceFrame';
import { DB_TABLES } from '@/utils/supabase/db_tables';

const montserrat = Montserrat({
   display: 'swap',
   subsets: ['latin'],
   preload: false,
});

export async function generateMetadata(): Promise<Metadata> {
   const headersList = await headers();
   const host = headersList.get('host') || '';
   const pathname = headersList.get('x-pathname') || '';
   const normalizedHost = host.replace(/^www\./, '');

   const domainData: Record<string, { title: string; description: string; favicon: string }> = {
      'groups.slavaveto.com': {
         title: 'Group',
         description: '',
         favicon: '/favicons/remote.png',
      },
      'meet.slavaveto.com': {
         title: 'Meet',
         description: '',
         favicon: '/favicons/remote.png',
      },
   };

   // Простая логика как раньше
   const data = domainData[normalizedHost] || {
      title: 'MyProjs',
      description: '',
      favicon: '/favicons/local.png?v=1',
   };


   return {
      title: "DaySync",
      description: data.description,
      icons: {
         icon: data.favicon,
      },
   };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
   const headersList = await headers();
   const host = headersList.get('host') || '';
   const normalizedHost = host.replace(/^www\./, '');
   
   // Локальное окружение - ТОЛЬКО localhost или 127.0.0.1 (компьютер разработчика)
   // Доступ по IP из локальной сети считается "удаленным" доступом (как прод)
   const isLocal = normalizedHost.includes('localhost') || normalizedHost.startsWith('127.0.0.1');

   return (
      <html
         lang="ru-RU"
         translate="no"
         className={`dark ${montserrat.className}`}
         suppressHydrationWarning
      >
         <head>
            {/*<link rel="manifest" href="/manifest.json"/>*/}
            <meta name="theme-color" content="#1e2329" media="(prefers-color-scheme: dark)" />
            <meta
               name="viewport"
               content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
            />

            <script
               dangerouslySetInnerHTML={{
                  __html: themeScript,
               }}
            />
         </head>

         <body className="antialiased">
            <Toaster position="bottom-center" />
            <MyClerkProvider>
               <HeroUiProvider>
                  <ThemeProvider>
                     <DeviceProvider>
                        <LocalizationProvider>
                           <DeviceFrame isLocal={isLocal}>{children}</DeviceFrame>
                           <GlobalToggles isLocal={isLocal} />
                           <DebugPanel isLocal={isLocal} />
                           {isLocal && (
                              <div
                                 className={clsx(
                                    'fixed inset-0 z-[9999] pointer-events-none',
                                    // 'border-4 border-[rgb(255,224,165)]',
                                    // 'border-4 border-orange-200',
                                    'border-0 border-red-400',
                                    // 'dark:border-orange-400/50'
                                 )}
                              />
                           )}
                        </LocalizationProvider>
                     </DeviceProvider>
                  </ThemeProvider>
               </HeroUiProvider>
            </MyClerkProvider>
         </body>
      </html>
   );
}
