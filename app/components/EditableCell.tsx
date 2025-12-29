import React, { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';

interface EditableCellProps {
   value: string;
   onSave: (val: string) => void;
   onChange?: (val: string) => void;
   isMultiline?: boolean;
   className?: string;
   autoFocus?: boolean;
   onCancel?: () => void;
   onBlur?: (val: string) => void;
   autoWidth?: boolean;
}

export const EditableCell = ({ 
   value, 
   onSave, 
   onChange,
   isMultiline = false,
   className,
   autoFocus,
   onCancel,
   onBlur: onBlurProp,
   autoWidth
}: EditableCellProps) => {
   const [localValue, setLocalValue] = useState(value);
   const textareaRef = useRef<HTMLTextAreaElement>(null);
   const isCanceling = useRef(false);

   useEffect(() => {
      setLocalValue(value);
   }, [value]);

   // Auto-resize
   useEffect(() => {
      // Only for textarea
      if (textareaRef.current && !autoWidth) {
         textareaRef.current.style.height = 'auto';
         textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
      }
   }, [localValue, autoWidth]);

   const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement> | React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setLocalValue(val);
      if (onChange) {
         onChange(val);
      }
   };

   const handleBlur = () => {
      if (onBlurProp) {
          onBlurProp(localValue);
      }

      if (isCanceling.current) {
         isCanceling.current = false;
         return;
      }
      
      if (localValue !== value) {
         onSave(localValue);
      }
   };

   const handleKeyDown = (e: React.KeyboardEvent) => {
      // Always save on Enter (without Shift)
      if (e.key === 'Enter' && !e.shiftKey) {
         e.preventDefault();
         (e.currentTarget as HTMLElement).blur();
      }
      if (e.key === 'Escape') {
         e.stopPropagation();
         e.preventDefault();
         isCanceling.current = true;
         setLocalValue(value);
         
         if (onCancel) onCancel();
         
         // Use setTimeout to ensure state updates and avoid event conflicts
         setTimeout(() => {
            if (textareaRef.current) {
               textareaRef.current.blur();
            }
         }, 0);
      }
   };

   if (autoWidth) {
      return (
         <div className={clsx("inline-grid items-center relative min-w-0", className)}>
            {/* Hidden span to define width based on content */}
            <span 
               className="col-start-1 row-start-1 invisible whitespace-pre px-1 pointer-events-none min-w-0"
               aria-hidden="true"
            >
               {localValue || "Empty"}
            </span>
            
            <input
               autoFocus={autoFocus}
               value={localValue}
               onChange={handleChange}
               onBlur={handleBlur}
               onKeyDown={handleKeyDown}
               className={clsx(
                  "col-start-1 row-start-1 w-full h-full bg-transparent border-none outline-none m-0 px-1 rounded min-w-0",
                  "focus:ring-0 placeholder:text-default-300 transition-colors leading-inherit font-inherit",
                  "focus:bg-primary-50/50 dark:focus:bg-primary-900/20",
               )}
               placeholder="Empty"
               spellCheck={false}
            />
         </div>
      );
   }

   return (
      <textarea
         ref={textareaRef}
         autoFocus={autoFocus}
         value={localValue}
         onChange={handleChange}
         onBlur={handleBlur}
         onKeyDownCapture={handleKeyDown}
         className={clsx(
            "bg-transparent border-none pl-1 mr-2 outline-none resize-none pb-[1px] rounded leading-tight overflow-hidden focus:ring-0 placeholder:text-default-300 transition-colors",
            !autoWidth && "w-full",
            "focus:bg-primary-50/50 dark:focus:bg-primary-900/20",
            className
         )}
         style={autoWidth ? { width: localValue.length + 'ch' } : undefined}
         placeholder="Empty"
         rows={1}
         spellCheck={false}
      />
   );
};
