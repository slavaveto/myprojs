import React, { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { Tooltip } from '@heroui/react';

interface EditableCellProps {
   value: string;
   onSave: (val: string) => void;
   onChange?: (val: string) => void;
   isMultiline?: boolean;
   className?: string;
   onValidate?: (val: string) => string | null;
   autoFocus?: boolean;
}

export const EditableCell = ({ 
   value, 
   onSave, 
   onChange,
   isMultiline = false,
   className,
   onValidate,
   autoFocus
}: EditableCellProps) => {
   const [localValue, setLocalValue] = useState(value);
   const [error, setError] = useState<string | null>(null);
   const textareaRef = useRef<HTMLTextAreaElement>(null);
   const isCanceling = useRef(false);

   useEffect(() => {
      setLocalValue(value);
      setError(null);
   }, [value]);

   // Auto-resize
   useEffect(() => {
      if (textareaRef.current) {
         textareaRef.current.style.height = 'auto';
         textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
      }
   }, [localValue]);

   const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setLocalValue(val);
      if (onChange) {
         onChange(val);
      }
      if (onValidate) {
         setError(onValidate(val));
      }
   };

   const handleBlur = () => {
      if (isCanceling.current) {
         isCanceling.current = false;
         return;
      }
      if (error) {
         // Revert on error
         setLocalValue(value);
         setError(null);
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
         if (!error) {
            (e.currentTarget as HTMLTextAreaElement).blur();
         }
      }
      if (e.key === 'Escape') {
         e.stopPropagation();
         e.preventDefault();
         isCanceling.current = true;
         setLocalValue(value);
         setError(null);
         
         // Use setTimeout to ensure state updates and avoid event conflicts
         setTimeout(() => {
            if (textareaRef.current) {
               textareaRef.current.blur();
            }
         }, 0);
      }
   };

   return (
      <Tooltip 
         content={error || ''} 
         color="danger" 
         placement="top" 
         isOpen={!!error}
         isDisabled={!error}
      >
         <textarea
            ref={textareaRef}
            autoFocus={autoFocus}
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDownCapture={handleKeyDown}
            className={clsx(
               "w-full bg-transparent border-none outline-none resize-none p-0.5 -m-0.5 rounded text-small leading-tight overflow-hidden focus:ring-0 placeholder:text-default-300 transition-colors",
               error ? "bg-danger-50 text-danger focus:bg-danger-100 placeholder:text-danger-300" : "focus:bg-primary-50/50 dark:focus:bg-primary-900/20",
               className
            )}
            placeholder="Empty"
            rows={1}
            spellCheck={false}
         />
      </Tooltip>
   );
};
