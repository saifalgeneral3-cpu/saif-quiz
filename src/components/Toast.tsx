import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismiss = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center w-full max-w-sm px-4 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={() => dismiss(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const config = {
    success: { icon: CheckCircle2, bg: 'bg-green-600', iconColor: 'text-white' },
    error: { icon: AlertCircle, bg: 'bg-red-600', iconColor: 'text-white' },
    info: { icon: Info, bg: 'bg-gray-800', iconColor: 'text-white' },
  };
  const { icon: Icon, bg } = config[toast.type];

  return (
    <div
      className={`flex items-center gap-3 rounded-xl ${bg} px-4 py-3 shadow-lg animate-slide-up pointer-events-auto w-full`}
    >
      <Icon className="h-5 w-5 text-white flex-shrink-0" />
      <p className="text-sm font-medium text-white flex-1">{toast.message}</p>
      <button onClick={onDismiss} className="text-white/70 hover:text-white flex-shrink-0">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
