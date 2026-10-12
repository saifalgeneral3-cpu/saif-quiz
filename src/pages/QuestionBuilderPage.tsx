import { useState, useEffect, useCallback } from 'react';
import { ArrowRight, Plus, Trash2, GripVertical, Pencil, Check, X, AlertCircle, FileText, Eye } from 'lucide-react';
import type { Question, QuestionInput, CorrectAnswer } from '@/types';
import { fetchQuestions, createQuestion, updateQuestion, deleteQuestion, reorderQuestions } from '@/services/questionService';
import { fetchExamById } from '@/services/examService';
import { ButtonLoader } from '@/components/Loader';
import { navigate } from '@/hooks/useRouter';

interface QuestionBuilderPageProps {
  examId: string;
}

const CHOICES: { key: CorrectAnswer; label: string }[] = [
  { key: 'A', label: 'A' },
  { key: 'B', label: 'B' },
  { key: 'C', label: 'C' },
  { key: 'D', label: 'D' },
];

export function QuestionBuilderPage({ examId }: QuestionBuilderPageProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [examTitle, setExamTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<QuestionInput>(emptyForm(0));
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Question | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [qs, exam] = await Promise.all([
        fetchQuestions(examId),
        fetchExamById(examId),
      ]);
      setQuestions(qs);
      setExamTitle(exam?.title ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء التحميل');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    load();
  }, [load]);

  const resetForm = () => {
    setForm(emptyForm(questions.length));
    setFormError(null);
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (q: Question) => {
    setEditingId(q.id);
    setShowForm(true);
    setFormError(null);
    setForm({
      question_text: q.question_text,
      choice_a: q.choice_a,
      choice_b: q.choice_b,
      choice_c: q.choice_c,
      choice_d: q.choice_d,
      correct_answer: q.correct_answer,
      points: q.points,
      order_index: q.order_index,
    });
  };

  const validateForm = (): string | null => {
    if (!form.question_text.trim()) return 'نص السؤال مطلوب';
    if (!form.choice_a.trim()) return 'الخيار A مطلوب';
    if (!form.choice_b.trim()) return 'الخيار B مطلوب';
    if (!form.choice_c.trim()) return 'الخيار C مطلوب';
    if (!form.choice_d.trim()) return 'الخيار D مطلوب';
    if (!form.points || form.points < 1) return 'الدرجات يجب أن تكون 1 على الأقل';
    return null;
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const cleanInput: QuestionInput = {
        question_text: form.question_text.trim(),
        choice_a: form.choice_a.trim(),
        choice_b: form.choice_b.trim(),
        choice_c: form.choice_c.trim(),
        choice_d: form.choice_d.trim(),
        correct_answer: form.correct_answer,
        points: Number(form.points),
        order_index: form.order_index,
      };

      if (editingId) {
        await updateQuestion(editingId, cleanInput);
      } else {
        await createQuestion(examId, cleanInput);
      }
      resetForm();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteQuestion(deleteTarget.id);
      setConfirmDelete(false);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحذف');
    } finally {
      setSaving(false);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === questions.length - 1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    const reordered = [...questions];
    [reordered[index], reordered[swapIndex]] = [reordered[swapIndex], reordered[index]];

    // Optimistic update
    setQuestions(reordered.map((q, i) => ({ ...q, order_index: i })));

    try {
      await reorderQuestions(examId, reordered.map((q) => q.id));
    } catch {
      await load();
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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin/exams')}
            className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <ArrowRight className="h-5 w-5" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">أسئلة الامتحان</h2>
            <p className="text-sm text-gray-500">{examTitle} — {questions.length} سؤال</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate(`/admin/exams/${examId}/preview`)}
            className="btn-secondary"
          >
            <Eye className="h-4 w-4" />
            <span>معاينة</span>
          </button>
          {!showForm && (
            <button
              onClick={() => { resetForm(); setShowForm(true); }}
              className="btn-primary"
            >
              <Plus className="h-4 w-4" />
              <span>سؤال جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700 font-medium">{error}</p>
        </div>
      )}

      {/* Question form */}
      {showForm && (
        <div className="card p-6 animate-scale-in">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-gray-900">
              {editingId ? 'تعديل السؤال' : 'سؤال جديد'}
            </h3>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Question text */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                نص السؤال <span className="text-red-500">*</span>
              </label>
              <textarea
                value={form.question_text}
                onChange={(e) => setForm({ ...form, question_text: e.target.value })}
                placeholder="اكتب السؤال هنا..."
                rows={3}
                className="input-field resize-none"
              />
            </div>

            {/* Choices */}
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">
                الخيارات <span className="text-red-500">*</span>
              </label>
              <p className="text-xs text-gray-400 -mt-1">اختر الإجابة الصحيحة بالضغط على الدائرة</p>
              {CHOICES.map((choice) => (
                <div key={choice.key} className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, correct_answer: choice.key })}
                    className={`flex-shrink-0 h-9 w-9 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all ${
                      form.correct_answer === choice.key
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 text-gray-500 hover:border-gray-400'
                    }`}
                  >
                    {form.correct_answer === choice.key ? <Check className="h-4 w-4" /> : choice.label}
                  </button>
                  <input
                    type="text"
                    value={form[`choice_${choice.key.toLowerCase()}` as keyof QuestionInput] as string}
                    onChange={(e) => setForm({ ...form, [`choice_${choice.key.toLowerCase()}`]: e.target.value })}
                    placeholder={`الخيار ${choice.label}`}
                    className="input-field flex-1"
                  />
                </div>
              ))}
            </div>

            {/* Points */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                درجة السؤال <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={form.points}
                onChange={(e) => setForm({ ...form, points: Number(e.target.value) })}
                min="1"
                step="0.5"
                className="input-field w-32"
              />
            </div>

            {/* Form error */}
            {formError && (
              <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 font-medium">{formError}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? <ButtonLoader /> : <span>{editingId ? 'حفظ التعديل' : 'إضافة السؤال'}</span>}
              </button>
              <button onClick={resetForm} className="btn-secondary">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {questions.length === 0 && !showForm && (
        <div className="card p-12 text-center">
          <div className="inline-flex h-20 w-20 rounded-3xl bg-gray-100 items-center justify-center text-gray-400 mb-6">
            <FileText className="h-10 w-10" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">لا توجد أسئلة بعد</h3>
          <p className="text-sm text-gray-500 mb-6">ابدأ بإضافة أول سؤال للامتحان</p>
          <button onClick={() => { resetForm(); setShowForm(true); }} className="btn-primary">
            <Plus className="h-4 w-4" />
            <span>إضافة سؤال</span>
          </button>
        </div>
      )}

      {/* Questions list */}
      {questions.length > 0 && (
        <div className="space-y-3">
          {questions.map((q, index) => (
            <div key={q.id} className="card p-5 hover:shadow-card-hover transition-shadow">
              <div className="flex items-start gap-3">
                {/* Drag handle + order */}
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleMove(index, 'up')}
                    disabled={index === 0}
                    className="text-gray-300 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <GripVertical className="h-5 w-5 rotate-180" />
                  </button>
                  <span className="text-sm font-bold text-gray-400">{index + 1}</span>
                  <button
                    onClick={() => handleMove(index, 'down')}
                    disabled={index === questions.length - 1}
                    className="text-gray-300 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <GripVertical className="h-5 w-5" />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <p className="font-semibold text-gray-900 leading-relaxed">{q.question_text}</p>
                    <span className="flex-shrink-0 rounded-lg bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                      {q.points} درجة
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {CHOICES.map((choice) => {
                      const choiceText = q[`choice_${choice.key.toLowerCase()}` as keyof Question] as string;
                      const isCorrect = q.correct_answer === choice.key;
                      return (
                        <div
                          key={choice.key}
                          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                            isCorrect
                              ? 'bg-green-50 border border-green-200 text-green-800 font-medium'
                              : 'bg-gray-50 border border-gray-100 text-gray-600'
                          }`}
                        >
                          <span className={`flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-xs font-bold ${
                            isCorrect ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                          }`}>
                            {isCorrect ? <Check className="h-3 w-3" /> : choice.label}
                          </span>
                          <span className="truncate">{choiceText}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-1 flex-shrink-0">
                  <button
                    onClick={() => startEdit(q)}
                    className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-blue-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => { setDeleteTarget(q); setConfirmDelete(true); }}
                    className="p-2 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setConfirmDelete(false)} />
          <div className="relative w-full max-w-md card p-6 animate-scale-in">
            <h3 className="text-lg font-bold text-gray-900 mb-2">حذف السؤال</h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-6">
              سيتم حذف السؤال "{deleteTarget.question_text.slice(0, 50)}..." نهائياً.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(false)} className="btn-secondary flex-1">
                إلغاء
              </button>
              <button
                onClick={handleDelete}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 hover:bg-red-700 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98] flex-1 disabled:opacity-50"
              >
                {saving ? <ButtonLoader /> : 'حذف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function emptyForm(orderIndex: number): QuestionInput {
  return {
    question_text: '',
    choice_a: '',
    choice_b: '',
    choice_c: '',
    choice_d: '',
    correct_answer: 'A',
    points: 1,
    order_index: orderIndex,
  };
}
