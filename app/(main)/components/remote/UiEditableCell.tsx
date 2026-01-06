import React, { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { Tooltip } from '@heroui/react';

interface UiEditableCellProps {
   value: string;
   onSave: (val: string) => void;
   onChange?: (val: string) => void;
   isMultiline?: boolean;
   className?: string;
   onValidate?: (val: string) => string | null;
   autoFocus?: boolean;
   placeholder?: string;
   onCancel?: () => void;
   onBlur?: (val: string) => void;
   id?: string;
}

export const UiEditableCell = ({ 
   value, 
   onSave, 
   onChange,
   isMultiline = false,
   className,
   onValidate,
   autoFocus,
   placeholder = "Empty",
   onCancel,
   onBlur,
   id
}: UiEditableCellProps) => {
   const [localValue, setLocalValue] = useState(value ?? '');
   const [error, setError] = useState<string | null>(null);
   const textareaRef = useRef<HTMLTextAreaElement>(null);
   const isCanceling = useRef(false);

   useEffect(() => {
      setLocalValue(value ?? '');
      setError(null);
   }, [value]);

   // Focus handling
   useEffect(() => {
      if (autoFocus && textareaRef.current) {
         // Small delay to ensure element is mounted and ready
         setTimeout(() => {
            if (textareaRef.current) {
               textareaRef.current.focus();
            }
         }, 200);
      }
   }, [autoFocus]);

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
         // Optional: trigger onCancel or handle error persistence? 
         // For now, mirroring admin behavior: revert and close.
         if (onCancel && (value === '' || value === undefined) && localValue !== '') {
             // If it was new (empty) and user entered invalid data, maybe we should delete it?
             // But here we just revert to empty. The parent handles delete if empty on blur.
         }
         return;
      }
      
      const finalVal = localValue;
      if (finalVal !== value) {
         onSave(finalVal);
      }
      if (onBlur) {
          onBlur(finalVal);
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
         
         if (onCancel) onCancel();

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
            id={id}
            ref={textareaRef}
            autoFocus={autoFocus}
            value={localValue ?? ''}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDownCapture={handleKeyDown}
            className={clsx(
               "w-full min-h-[28px] bg-transparent border-none outline-none resize-none  rounded text-small leading-tight overflow-hidden focus:ring-0 placeholder:text-default-300 transition-colors",
               error ? "bg-danger-50 text-danger focus:bg-danger-100 placeholder:text-danger-300" : "focus:bg-primary-50/50 dark:focus:bg-primary-900/20",
               className
            )}
            placeholder={placeholder}
            rows={1}
            spellCheck={false}
         />
      </Tooltip>
   );
};

