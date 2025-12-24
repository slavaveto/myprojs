import React, { useState, useRef } from 'react';
import { GripVertical, Sparkles, Loader2 } from 'lucide-react';
import { UIElement } from '@/utils/providers/localization/types';
import { EditableCell } from './EditableCell';
import { translateText } from './actions';
import { clsx } from 'clsx';
import { Button, Tooltip } from '@heroui/react';

interface CreationRowProps {
   onSave: (data: Partial<UIElement>) => Promise<void>;
   onCancel: () => void;
   tabId: string;
   onValidateId?: (id: string) => string | null;
}

export const CreationRow = ({ onSave, onCancel, tabId, onValidateId }: CreationRowProps) => {
   const [formData, setFormData] = useState<Partial<UIElement>>({
      item_id: '',
      ru: '',
      uk: '',
      en: '',
      tab_id: tabId,
   });
   // Use ref to access latest data in onBlur handler immediately
   const formDataRef = useRef(formData);
   const [idError, setIdError] = useState<string | null>(null);
   const isSavingRef = useRef(false);
   const [isTranslating, setIsTranslating] = useState(false);

   const [isTranslatingEn, setIsTranslatingEn] = useState(false);
   const [isTranslatingUk, setIsTranslatingUk] = useState(false);

   const updateFieldState = (field: keyof UIElement, val: string) => {
      const newData = { ...formDataRef.current, [field]: val };
      formDataRef.current = newData;
      setFormData(newData);
   };

   const handleTranslate = async (targetLang?: 'uk' | 'en') => {
      const textToTranslate = formData.ru;
      if (!textToTranslate) return;
      
      if (targetLang === 'uk' && isTranslatingUk) return;
      if (targetLang === 'en' && isTranslatingEn) return;
      if (!targetLang && isTranslating) return;

      if (targetLang === 'uk') setIsTranslatingUk(true);
      else if (targetLang === 'en') setIsTranslatingEn(true);
      else setIsTranslating(true);

      try {
         const result = await translateText(textToTranslate, targetLang);
         
         if (result.error) {
            alert(`Translation failed: ${result.error}`);
            return;
         }

         const newData = { ...formDataRef.current };
         if (result.uk) newData.uk = result.uk;
         if (result.en) newData.en = result.en;
         
         formDataRef.current = newData;
         setFormData(newData);
      } catch (error) {
      } finally {
         if (targetLang === 'uk') setIsTranslatingUk(false);
         else if (targetLang === 'en') setIsTranslatingEn(false);
         else setIsTranslating(false);
      }
   };

   const handleIdUpdate = (val: string) => {
      updateFieldState('item_id', val);
   };

   const handleRowBlur = async (e: React.FocusEvent) => {
      // Check if focus is moving to another element inside the row
      if (e.currentTarget.contains(e.relatedTarget as Node)) {
         return;
      }

      // Focus left the row completely -> Try to Save
      const data = formDataRef.current;
      
      if (!data.item_id) {
         onCancel();
         return;
      }

      if (idError || isSavingRef.current) return;

      isSavingRef.current = true;
      try {
         await onSave(data);
      } catch (e) {
         isSavingRef.current = false;
      }
   };

   const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
         onCancel();
      }
      // Enter is handled by EditableCell -> triggers blur -> triggers handleRowBlur -> save
   };

   return (
      <div 
         className={clsx(
            "grid grid-cols-[200px_1fr_1fr_1fr_120px] gap-1 items-center min-h-[32px] rounded-lg border border-primary/20 bg-primary-50/50 mb-1 transition-colors",
         )}
         onKeyDown={handleKeyDown}
         onBlur={handleRowBlur}
         tabIndex={-1} // Allow div to handle focus events appropriately
      >
         <div className="p-1 pl-2 text-start relative whitespace-normal overflow-hidden">
            <div className="flex items-center gap-1">
               {/* Placeholder for Drag Handle */}
               <div className="text-transparent outline-none p-0.5">
                  <GripVertical size={14} />
               </div>

               <div className="flex flex-col min-w-0 w-full">
                  <EditableCell
                     value={formData.item_id || ''}
                     onSave={handleIdUpdate}
                     onValidate={(val) => {
                        if (onValidateId) {
                           const err = onValidateId(val);
                           setIdError(err);
                           return err;
                        }
                        return null;
                     }}
                     isMultiline={false}
                     className="font-mono text-xs font-bold text-primary truncate"
                     autoFocus
                  />
               </div>
            </div>
         </div>
         <div className="p-1 text-start relative whitespace-normal border-l border-divider/50 flex items-center group/ru pr-6">
            <EditableCell
               value={formData.ru || ''}
               onSave={(val) => updateFieldState('ru', val)}
               onChange={(val) => updateFieldState('ru', val)}
               isMultiline
            />
            {formData.ru && (
               <div className="absolute right-0.5 top-0 z-10 h-full flex items-center">
                  <Button
                     isIconOnly
                     size="sm"
                     variant="light"
                     className="h-6 w-6 min-w-4 text-default-300 hover:text-warning transition-colors"
                     onPress={() => handleTranslate()}
                     isLoading={isTranslating}
                  >
                     {!isTranslating && <Sparkles size={14} />}
                  </Button>
               </div>
            )}
         </div>
         <div className="p-1 text-start relative whitespace-normal border-l border-divider/50 flex items-center group/uk pr-6">
            {isTranslatingUk || (isTranslating && !formData.uk) ? (
               <div className="w-full flex justify-center py-1 opacity-50">
                  <Loader2 size={14} className="animate-spin text-default-400" />
               </div>
            ) : (
               <>
                  <EditableCell
                     value={formData.uk || ''}
                     onSave={(val) => updateFieldState('uk', val)}
                     isMultiline
                  />
                  {formData.ru && (
                     <div className="absolute right-0.5 top-0 z-10 h-full flex items-center opacity-0 group-hover/uk:opacity-100 transition-opacity">
                        <Button
                           isIconOnly
                           size="sm"
                           variant="light"
                           className="h-6 w-6 min-w-4 text-default-300 hover:text-warning transition-colors"
                           onPress={() => handleTranslate('uk')}
                           isLoading={isTranslatingUk}
                        >
                           {!isTranslatingUk && <Sparkles size={14} />}
                        </Button>
                     </div>
                  )}
               </>
            )}
         </div>
         <div className="p-1 text-start relative whitespace-normal border-l border-divider/50 flex items-center group/en pr-6">
            {isTranslatingEn || (isTranslating && !formData.en) ? (
               <div className="w-full flex justify-center py-1 opacity-50">
                  <Loader2 size={14} className="animate-spin text-default-400" />
               </div>
            ) : (
               <>
                  <EditableCell
                     value={formData.en || ''}
                     onSave={(val) => updateFieldState('en', val)}
                     isMultiline
                  />
                  {formData.ru && (
                     <div className="absolute right-0.5 top-0 z-10 h-full flex items-center opacity-0 group-hover/en:opacity-100 transition-opacity">
                        <Button
                           isIconOnly
                           size="sm"
                           variant="light"
                           className="h-6 w-6 min-w-4 text-default-300 hover:text-warning transition-colors"
                           onPress={() => handleTranslate('en')}
                           isLoading={isTranslatingEn}
                        >
                           {!isTranslatingEn && <Sparkles size={14} />}
                        </Button>
                     </div>
                  )}
               </>
            )}
         </div>
         <div className="p-1 text-end relative whitespace-normal border-l border-divider/50 pr-2 flex justify-end items-center">
             {/* No actions for creation row */}
         </div>
      </div>
   );
};
