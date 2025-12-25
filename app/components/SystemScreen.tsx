import React from 'react';

interface SystemScreenProps {
    title: string;
}

export const SystemScreen = ({ title }: SystemScreenProps) => {
   return (
      <div className="h-full flex flex-col p-6 max-w-5xl mx-auto w-full">
         <div className="flex justify-between items-center mb-6 min-h-[40px]">
            <h1 className="text-2xl font-bold">{title}</h1>
            <div className="flex items-center gap-2">
               {/* Future actions */}
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

