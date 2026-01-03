'use client';

import { Tabs, Tab } from '@heroui/react';
import React from 'react';
import { useLocalization } from '@/utils/localization/LocalizationProvider';

export default function LangToggle() {
   const { language, setLanguage } = useLocalization();

   return (
      <Tabs
         aria-label="Language selection"
         color="default"
         size="sm"
         selectedKey={language}
         onSelectionChange={(key) => setLanguage(key as 'ru' | 'uk' | 'en')}
         classNames={{
            tabList:
               'gap-[0px] p-[1px] rounded-[10px] !bg-default-200 dark:!bg-default-100 border border-default-300',
            tab: 'h-[28px]  px-[10px] md:px-[8px] rounded-small',
            tabContent: 'group-data-[selected=true]:text-primary-400',
         }}
      >
         <Tab
            key="uk"
            className="font-semibold text-[12px]"
            title={<div className="flex items-center mt-[2px]">UA</div>}
         />
         <Tab
            key="ru"
            className="font-semibold text-[12px]"
            title={<div className="flex items-center mt-[2px]">RU</div>}
         />
         <Tab
            key="en"
            className="font-semibold text-[12px]"
            title={<div className="flex items-center mt-[2px]">EN</div>}
         />
      </Tabs>
   );
}
