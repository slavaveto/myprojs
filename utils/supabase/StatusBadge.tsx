import React from 'react';
import { Chip } from "@heroui/react";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { ActionStatus } from "@/utils/supabase/useAsyncAction";

export interface StatusBadgeProps {
  status: ActionStatus;
  loadingText?: string;
  successText?: string;
  errorText?: string;
  errorMessage?: string; // Если нужно показать конкретный текст ошибки
  className?: string;
  suppressLoading?: boolean; // Если true, скрывает статус 'loading' (для гибридных режимов)
}

export const StatusBadge = ({
  status,
  loadingText = "Saving...",
  successText = "Saved",
  errorText = "Error saving",
  errorMessage,
  className,
  suppressLoading
}: StatusBadgeProps) => {
  const effectiveStatus = (suppressLoading && status === 'loading') ? 'idle' : status;

  if (effectiveStatus === 'idle') return null;

  return (
    <div className={className}>
      {effectiveStatus === 'loading' && (
        <Chip startContent={<Loader2 className="animate-spin" size={16} />} color="warning" variant="flat" size="md" className="px-2">
          {loadingText}
        </Chip>
      )}
      {effectiveStatus === 'success' && (
        <Chip startContent={<CheckCircle2 size={16} />} color="success" variant="flat" size="md" className="px-2">
          {successText}
        </Chip>
      )}
      {effectiveStatus === 'error' && (
        <Chip 
            startContent={<AlertCircle size={16} />} 
            color="danger" 
            variant="flat" 
            size="md"
            title={errorMessage} // Показываем ошибку при наведении
            className="px-2"
        >
          {errorMessage || errorText}
        </Chip>
      )}
    </div>
  );
};
