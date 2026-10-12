import { useState, useEffect, useCallback } from 'react';
import { ArrowRight, Save, AlertCircle, FileText } from 'lucide-react';
import type { ExamInput } from '@/types';
import { fetchExamById, createExam, updateExam } from '@/services/examService';
import { ButtonLoader } from '@/components/Loader';
import { navigate } from '@/hooks/useRouter';

interface ExamFormPageProps {
  adminId: string;
  examId?: string;
}

export function ExamFormPage({ adminId, examId }: ExamFormPageProps) {
  const isEdit = !!examId;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!examId) return;
    setLoading(true);
    try {
      const exam = await fetchExamById(examId);
      if (exam) {
        setTitle(exam.title);
        setDescription(exam.description ?? '');
        setDurationMinutes(exam.duration_minutes?.toString() ?? '');
        setStartAt(exam.start_at ? toLocalDateTime(exam.start_at) : '');
        setEndAt(exam.end_at ? toLocalDateTime(exam.end_at) : '');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء تحميل الامتحان');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('عنوان الامتحان مطلوب');
      return;
    }

    setSaving(true);

    const input: ExamInput = {
      title: title.trim(),
      description: description.trim() || null,
      duration_minutes: durationMinutes ? parseInt(durationMinutes, 10) : null,
      status: 'draft',
      start_at: startAt ? new Date(startAt).toISOString() : null,
      end_at: endAt ? new Date(endAt).toISOString() : null,
    };

    try {
      if (isEdit && examId) {
        await updateExam(examId, input);
        navigate(`/admin/exams/${examId}/questions`);
      } else {
        const exam = await createExam(input, adminId);
        navigate(`/admin/exams/${exam.id}/questions`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <ButtonLoader className="h-8 w-8 text-blue-700" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/exams')}
          className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{isEdit ? 'تعديل الامتحان' : 'امتحان جديد'}</h2>
            <p className="text-sm text-gray-500">{isEdit ? 'عدّل بيانات الامتحان' : 'أدخل بيانات الامتحان الجديد'}</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="card p-8">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              عنوان الامتحان <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: امتحان الرياضيات - الفصل الأول"
              required
              className="input-field"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              وصف الامتحان
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="وصف مختصر للامتحان (اختياري)"
              rows={3}
              className="input-field resize-none"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              مدة الامتحان (بالدقائق)
            </label>
            <input
              type="number"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              placeholder="60"
              min="1"
              className="input-field"
            />
            <p className="mt-1.5 text-xs text-gray-400">اتركه فارغاً إذا لم يكن هناك وقت محدد</p>
          </div>

          {/* Date range */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                تاريخ بدء الامتحان
              </label>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                تاريخ انتهاء الامتحان
              </label>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="input-field"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3 animate-fade-in">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? <ButtonLoader /> : (
                <>
                  <Save className="h-4 w-4" />
                  <span>{isEdit ? 'حفظ التعديلات' : 'إنشاء وإضافة الأسئلة'}</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate('/admin/exams')}
              className="btn-secondary"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function toLocalDateTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
