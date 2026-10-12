import type { ExamStatus } from '@/types';

const STATUS_CONFIG: Record<ExamStatus, { label: string; bg: string; text: string; dot: string }> = {
  draft: { label: 'مسودة', bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  active: { label: 'مفعّل', bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
  inactive: { label: 'متوقف', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  finished: { label: 'منتهي', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
};

export function StatusBadge({ status, size = 'md' }: { status: ExamStatus; size?: 'sm' | 'md' }) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${padding} ${config.bg} ${config.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

export function getStatusLabel(status: ExamStatus): string {
  return STATUS_CONFIG[status]?.label ?? status;
}
