import React from 'react';
import { clsx } from 'clsx';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { useUIStore } from '@/stores';

const ToastIcon: Record<string, React.ReactNode> = {
  success: <CheckCircle className="w-5 h-5 text-success-500" />,
  error: <AlertCircle className="w-5 h-5 text-error-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-warning-500" />,
  info: <Info className="w-5 h-5 text-primary-500" />,
};

const ToastStyles: Record<string, string> = {
  success: 'border-success-200 bg-success-50 dark:border-success-800 dark:bg-success-900/20',
  error: 'border-error-200 bg-error-50 dark:border-error-800 dark:bg-error-900/20',
  warning: 'border-warning-200 bg-warning-50 dark:border-warning-800 dark:bg-warning-900/20',
  info: 'border-primary-200 bg-primary-50 dark:border-primary-800 dark:bg-primary-900/20',
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useUIStore();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={clsx(
            'flex items-start gap-3 px-4 py-3 rounded-lg border shadow-soft',
            'animate-slide-left min-w-[300px] max-w-[400px]',
            ToastStyles[toast.type]
          )}
        >
          {ToastIcon[toast.type]}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-surface-900 dark:text-surface-100">
              {toast.title}
            </p>
            {toast.message && (
              <p className="text-sm text-surface-600 dark:text-surface-400 mt-0.5">
                {toast.message}
              </p>
            )}
          </div>
          <button
            onClick={() => removeToast(toast.id)}
            className="p-1 rounded text-surface-400 hover:text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700 dark:hover:text-surface-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};

export const useToast = () => {
  const { addToast } = useUIStore();

  return {
    success: (title: string, message?: string) =>
      addToast({ type: 'success', title, message }),
    error: (title: string, message?: string) =>
      addToast({ type: 'error', title, message }),
    warning: (title: string, message?: string) =>
      addToast({ type: 'warning', title, message }),
    info: (title: string, message?: string) =>
      addToast({ type: 'info', title, message }),
  };
};
