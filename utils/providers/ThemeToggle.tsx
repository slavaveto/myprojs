'use client';

import { Tabs, Tab } from '@heroui/react';
import { LightThemeIcon, DarkThemeIcon, AutoThemeIcon } from '@/utils/providers/themeIcons';
import React from 'react';
import { useTheme } from '@/utils/providers/ThemeProvider';

interface ThemeToggleProps {
   disableInGridMode?: boolean; // true = блокировать в Grid (для Room), false = не блокировать (для Entry)
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({ disableInGridMode = false }) => {
   const { theme, setTheme } = useTheme();
   


   return (
      <Tabs
         aria-label="Выбор темы"
         color="default"
         size="sm"
         selectedKey={theme}
      onSelectionChange={(key) => {
        setTheme(key as 'light' | 'dark' | 'system');
      }}
         classNames={{
        tabList:
          `gap-[0px] p-[1px] rounded-[10px] !bg-default-200 dark:!bg-default-100 border border-default-300 }`,
            tab: 'h-[28px] px-[10px] md:px-[8px] rounded-small',
            tabContent: 'group-data-[selected=true]:text-primary-400',
         }}
   
      >
         <Tab
            key="light"
            title={
               <div className="flex items-center">
                  <LightThemeIcon />
               </div>
            }
         />
         <Tab
            key="system"
            title={
               <div className="flex items-center mt-[2px]">
                  <AutoThemeIcon />
               </div>
            }
         />
         <Tab
            key="dark"
            title={
               <div className="flex items-center">
                  <DarkThemeIcon />
               </div>
            }
         />
      </Tabs>
   );
};

export default ThemeToggle;
