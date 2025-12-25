import React from 'react';
import { StatusBadge } from '@/utils/supabase/StatusBadge';
import { ActionStatus } from '@/utils/supabase/useAsyncAction';

interface SystemScreenProps {
    title: string;
    globalStatus?: ActionStatus;
    canLoad?: boolean;
}

export const SystemScreen = ({ title, globalStatus = 'idle', canLoad = true }: SystemScreenProps) => {
   // Here you would add useEffect to load data if canLoad is true
   
   return (
      <div className="h-full flex flex-col p-6 max-w-5xl mx-auto w-full">
         <div className="flex justify-between items-center mb-6 min-h-[40px]">
            <h1 className="text-2xl font-bold">{title}</h1>
            <div className="flex items-center gap-2">
               <StatusBadge 
                   status={globalStatus}
                   loadingText="Saving..."
                   successText="Saved"
               />
            </div>
         </div>
         <div className="flex-grow overflow-y-auto">
             <div className="text-default-400 text-center mt-20">
                 No tasks in {title} yet.
             </div>
         </div>
      </div>
   );
};

