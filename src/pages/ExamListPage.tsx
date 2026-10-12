import { useState, useEffect, useCallback } from 'react';
import { Plus, FileText, Clock, Calendar, MoreVertical, Pencil, Trash2, Play, Pause, CheckCircle, Eye, AlertCircle } from 'lucide-react';
import type { Exam, ExamStatus } from '@/types';
import { fetchExams, deleteExam, updateExamStatus } from '@/services/examService';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PageLoader } from '@/components/Loader';
import { useToast } from '@/components/Toast';
import { navigate } from '@/hooks/useRouter';

export function ExamListPage() {
  const { showToast } = useToast();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Exam | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ exam: Exam; action: 'activate' | 'deactivate' | 'finish'; label: string; message: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchExams();
      setExams(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء تحميل الامتحانات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Close menu on outside click
  useEffect(() => {
    const handler = () => setMenuOpen(null);
    if (menuOpen) {
      window.addEventListener('click', handler);
      return () => window.removeEventListener('click', handler);
    }
  }, [menuOpen]);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setActionLoading(true);
    try {
      await deleteExam(confirmDelete.id);
      setConfirmDelete(null);
      showToast('تم حذف الامتحان', 'success');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحذف');
      showToast('تعذّر حذف الامتحان', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusAction = async () => {
    if (!confirmAction) return;
    setActionLoading(true);
    try {
      const newStatus: ExamStatus =
        confirmAction.action === 'activate' ? 'active' :
        confirmAction.action === 'deactivate' ? 'inactive' : 'finished';
      await updateExamStatus(confirmAction.exam.id, newStatus);
      setConfirmAction(null);
      showToast('تم تحديث حالة الامتحان', 'success');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
      showToast('تعذّر تحديث حالة الامتحان', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const promptAction = (exam: Exam, action: 'activate' | 'deactivate' | 'finish') => {
    setMenuOpen(null);
    const config = {
      activate: { label: 'تفعيل', message: `سيتم تفعيل الامتحان "${exam.title}" وسيصبح متاحاً للطلاب.` },
      deactivate: { label: 'إيقاف', message: `سيتم إيقاف الامتحان "${exam.title}" ولن يكون متاحاً للطلاب مؤقتاً.` },
      finish: { label: 'إنهاء', message: `سيتم إنهاء الامتحان "${exam.title}" بشكل نهائي ولن يقبل أي محاولات جديدة.` },
    };
    setConfirmAction({ exam, action, ...config[action] });
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">إدارة الامتحانات</h2>
          <p className="text-sm text-gray-500 mt-1">إنشاء وتعديل وإدارة جميع الامتحانات</p>
        </div>
        <button
          onClick={() => navigate('/admin/exams/new')}
          className="btn-primary"
        >
          <Plus className="h-4 w-4" />
          <span>امتحان جديد</span>
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {exams.length === 0 && !error && (
        <div className="card p-12 text-center">
          <div className="inline-flex h-20 w-20 rounded-3xl bg-gray-100 items-center justify-center text-gray-400 mb-6">
            <FileText className="h-10 w-10" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">لا توجد امتحانات بعد</h3>
          <p className="text-sm text-gray-500 mb-6">ابدأ بإنشاء أول امتحان للمنصة</p>
          <button onClick={() => navigate('/admin/exams/new')} className="btn-primary">
            <Plus className="h-4 w-4" />
            <span>إنشاء امتحان</span>
          </button>
        </div>
      )}

      {/* Exam cards */}
      {exams.length > 0 && (
        <div className="grid gap-4">
          {exams.map((exam) => (
            <div key={exam.id} className="card p-5 hover:shadow-card-hover transition-shadow">
              <div className="flex items-start justify-between gap-4">
                {/* Left: info */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700 flex-shrink-0">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-gray-900 truncate">{exam.title}</h3>
                      <StatusBadge status={exam.status} size="sm" />
                    </div>
                    {exam.description && (
                      <p className="text-sm text-gray-500 line-clamp-2 mb-2">{exam.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-400 flex-wrap">
                      {exam.duration_minutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {exam.duration_minutes} دقيقة
                        </span>
                      )}
                      {exam.start_at && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(exam.start_at).toLocaleDateString('ar-EG')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: actions menu */}
                <div className="relative flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(menuOpen === exam.id ? null : exam.id);
                    }}
                    className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>
                  {menuOpen === exam.id && (
                    <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 animate-scale-in">
                      <button
                        onClick={() => { setMenuOpen(null); navigate(`/admin/exams/${exam.id}/edit`); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Pencil className="h-4 w-4" /> تعديل
                      </button>
                      <button
                        onClick={() => { setMenuOpen(null); navigate(`/admin/exams/${exam.id}/preview`); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <Eye className="h-4 w-4" /> معاينة
                      </button>
                      <button
                        onClick={() => { setMenuOpen(null); navigate(`/admin/exams/${exam.id}/questions`); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <FileText className="h-4 w-4" /> الأسئلة
                      </button>
                      <div className="border-t border-gray-100 my-1" />
                      {exam.status !== 'active' && exam.status !== 'finished' && (
                        <button
                          onClick={() => promptAction(exam, 'activate')}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-green-700 hover:bg-green-50"
                        >
                          <Play className="h-4 w-4" /> تفعيل
                        </button>
                      )}
                      {exam.status === 'active' && (
                        <button
                          onClick={() => promptAction(exam, 'deactivate')}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-amber-700 hover:bg-amber-50"
                        >
                          <Pause className="h-4 w-4" /> إيقاف
                        </button>
                      )}
                      {exam.status !== 'finished' && (
                        <button
                          onClick={() => promptAction(exam, 'finish')}
                          className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-blue-700 hover:bg-blue-50"
                        >
                          <CheckCircle className="h-4 w-4" /> إنهاء
                        </button>
                      )}
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        onClick={() => { setMenuOpen(null); setConfirmDelete(exam); }}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" /> حذف
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="حذف الامتحان"
        message={`سيتم حذف الامتحان "${confirmDelete?.title}" وجميع أسئلته نهائياً. لا يمكن التراجع عن هذا الإجراء.`}
        confirmLabel={actionLoading ? 'جاري الحذف...' : 'حذف نهائي'}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* Status action confirmation */}
      <ConfirmDialog
        open={confirmAction !== null}
        title={confirmAction?.label ?? ''}
        message={confirmAction?.message ?? ''}
        confirmLabel={actionLoading ? 'جاري التنفيذ...' : confirmAction?.label ?? ''}
        variant={confirmAction?.action === 'finish' ? 'warning' : 'danger'}
        onConfirm={handleStatusAction}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
