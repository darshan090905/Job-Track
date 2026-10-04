import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const remove = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  const icons = { success: CheckCircle, error: XCircle, info: Info };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2">
        {toasts.map(t => {
          const Icon = icons[t.type];
          return (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1">{t.message}</span>
              <button onClick={() => remove(t.id)} className="opacity-60 hover:opacity-100 transition-opacity">
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
