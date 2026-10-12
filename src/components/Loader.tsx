import { type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export function FullPageLoader({ message = 'جاري التحميل...' }: { message?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
      <Loader2 className="h-10 w-10 animate-spin text-blue-700" />
      <p className="mt-4 text-sm text-gray-500 font-medium">{message}</p>
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} />;
}

export function PageLoader() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-blue-700" />
    </div>
  );
}

export function LoadingOverlay({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
      <Loader2 className="h-10 w-10 animate-spin text-blue-700" />
      {message && <p className="mt-4 text-sm text-gray-600 font-medium">{message}</p>}
    </div>
  );
}

export function ButtonLoader({ className = 'h-4 w-4' }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin`} />;
}

export function InlineLoader({ children }: { children?: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      {children}
    </div>
  );
}
