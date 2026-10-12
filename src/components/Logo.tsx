import { GraduationCap, ShieldCheck } from 'lucide-react';
import { navigate } from '@/hooks/useRouter';

export function Logo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: { icon: 'h-8 w-8', text: 'text-xl', sub: 'text-xs' },
    md: { icon: 'h-10 w-10', text: 'text-2xl', sub: 'text-sm' },
    lg: { icon: 'h-14 w-14', text: 'text-3xl', sub: 'text-base' },
  };
  const s = sizes[size];

  return (
    <button
      onClick={() => navigate('/')}
      className="flex flex-col items-center gap-1"
    >
      <div className="flex items-center gap-2">
        <div className={`${s.icon} rounded-xl bg-blue-700 flex items-center justify-center text-white shadow-sm`}>
          <GraduationCap className="h-1/2 w-1/2" />
        </div>
        <span className={`${s.text} font-bold text-gray-900 tracking-tight`}>
          Saif<span className="text-blue-700">Quiz</span>
        </span>
      </div>
      <span className={`${s.sub} text-gray-500 font-medium`}>منصة الاختبارات الإلكترونية</span>
    </button>
  );
}

export function LogoMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-14 w-14',
  };
  return (
    <div className={`${sizes[size]} rounded-xl bg-blue-700 flex items-center justify-center text-white shadow-sm`}>
      <GraduationCap className="h-1/2 w-1/2" />
    </div>
  );
}

export function AdminBadge({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const s = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
      <ShieldCheck className={s} />
      أدمن
    </div>
  );
}
