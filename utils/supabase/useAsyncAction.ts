import { useState, useCallback } from 'react';
import toast from 'react-hot-toast';

export type ActionStatus = 'idle' | 'loading' | 'success' | 'error';

interface UseAsyncActionOptions {
  minDuration?: number;      // Минимальное время показа лоадера (мс), по умолчанию 1000
  successDuration?: number;  // Сколько висит "Успех" (мс), по умолчанию 2000
  resetErrorAfter?: number;  // Через сколько сбрасывать ошибку (мс), по умолчанию 4000
  onError?: (error: any) => void; // Дополнительный обработчик ошибок
  
  // Toast options
  useToast?: boolean;
  loadingMessage?: string;
  successMessage?: string;
  errorMessage?: string | ((err: any) => string);
}

export function useAsyncAction(options: UseAsyncActionOptions = {}) {
  const { 
    minDuration = 800, 
    successDuration = 2000, 
    resetErrorAfter = 4000,
    onError,
    useToast = false,
    loadingMessage = 'Saving...',
    successMessage = 'Saved!',
    errorMessage = 'Error occurred'
  } = options;
  
  const [status, setStatus] = useState<ActionStatus>('idle');
  const [error, setError] = useState<Error | null>(null);

  const execute = useCallback(async <T>(action: () => Promise<T>): Promise<T | undefined> => {
    setStatus('loading');
    setError(null);
    const startTime = Date.now();

    // Wrap the action to include delay logic
    const promise = (async () => {
        try {
            const result = await action();
            
            const elapsed = Date.now() - startTime;
            const remainingTime = Math.max(0, minDuration - elapsed);

            if (remainingTime > 0) {
                await new Promise(resolve => setTimeout(resolve, remainingTime));
            }
            return result;
        } catch (err) {
            const elapsed = Date.now() - startTime;
            const remainingTime = Math.max(0, minDuration - elapsed);
            if (remainingTime > 0) {
                await new Promise(resolve => setTimeout(resolve, remainingTime));
            }
            throw err;
        }
    })();

    if (useToast) {
        toast.promise(promise, {
            loading: loadingMessage,
            success: successMessage,
            error: errorMessage
        });
    }

    try {
      const result = await promise;

      setStatus('success');
      
      if (successDuration > 0) {
        setTimeout(() => {
          setStatus(prev => prev === 'success' ? 'idle' : prev);
        }, successDuration);
      }

      return result;
    } catch (err: any) {
      setError(err);
      setStatus('error');
      
      if (onError) onError(err);
      
      if (resetErrorAfter > 0) {
        setTimeout(() => {
           setStatus(prev => prev === 'error' ? 'idle' : prev);
        }, resetErrorAfter);
      }
      
      throw err;
    }
  }, [minDuration, successDuration, resetErrorAfter, onError, useToast, loadingMessage, successMessage, errorMessage]);

  // Ручной сброс
  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return { status, error, execute, reset, setStatus };
}
