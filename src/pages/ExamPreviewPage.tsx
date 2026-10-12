import { useState, useEffect, useCallback } from 'react';
import { ArrowRight, Check, Clock, Calendar, FileText, AlertCircle } from 'lucide-react';
import type { Exam, Question } from '@/types';
import { fetchExamById } from '@/services/examService';
import { fetchQuestions } from '@/services/questionService';
import { StatusBadge } from '@/components/StatusBadge';
import { PageLoader } from '@/components/Loader';
import { navigate } from '@/hooks/useRouter';

interface ExamPreviewPageProps {
  examId: string;
}

const CHOICE_LABELS = ['A', 'B', 'C', 'D'] as const;

export function ExamPreviewPage({ examId }: ExamPreviewPageProps) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [e, qs] = await Promise.all([
        fetchExamById(examId),
        fetchQuestions(examId),
      ]);
      setExam(e);
      setQuestions(qs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء التحميل');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <PageLoader />;

  if (error || !exam) {
    return (
      <div className="space-y-4 animate-fade-in">
        {error && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}
        <button onClick={() => navigate('/admin/exams')} className="btn-secondary">
          <ArrowRight className="h-4 w-4" />
          <span>العودة للامتحانات</span>
        </button>
      </div>
    );
  }

  const totalPoints = questions.reduce((sum, q) => sum + Number(q.points), 0);

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/admin/exams')}
          className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold text-gray-900">معاينة الامتحان</h2>
          <p className="text-sm text-gray-500">هكذا سيظهر الامتحان للطلاب</p>
        </div>
      </div>

      {/* Exam info card */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700 flex-shrink-0">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{exam.title}</h3>
              {exam.description && (
                <p className="text-sm text-gray-500 mt-1 leading-relaxed">{exam.description}</p>
              )}
            </div>
          </div>
          <StatusBadge status={exam.status} />
        </div>
        <div className="flex items-center gap-6 text-sm text-gray-500 flex-wrap pt-4 border-t border-gray-100">
          {exam.duration_minutes && (
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-gray-400" />
              {exam.duration_minutes} دقيقة
            </span>
          )}
          {exam.start_at && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-gray-400" />
              يبدأ: {new Date(exam.start_at).toLocaleString('ar-EG')}
            </span>
          )}
          {exam.end_at && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-gray-400" />
              ينتهي: {new Date(exam.end_at).toLocaleString('ar-EG')}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-gray-400" />
            {questions.length} سؤال
          </span>
          <span className="font-semibold text-gray-700">
            المجموع: {totalPoints} درجة
          </span>
        </div>
      </div>

      {/* Questions */}
      {questions.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="inline-flex h-16 w-16 rounded-2xl bg-gray-100 items-center justify-center text-gray-400 mb-4">
            <FileText className="h-8 w-8" />
          </div>
          <h3 className="font-bold text-gray-900 mb-1">لا توجد أسئلة</h3>
          <p className="text-sm text-gray-500 mb-4">لم تتم إضافة أسئلة لهذا الامتحان بعد</p>
          <button
            onClick={() => navigate(`/admin/exams/${examId}/questions`)}
            className="btn-primary"
          >
            إضافة أسئلة
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q, index) => (
            <div key={q.id} className="card p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 h-8 w-8 rounded-lg bg-blue-700 text-white flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </span>
                  <p className="font-semibold text-gray-900 leading-relaxed pt-1">{q.question_text}</p>
                </div>
                <span className="flex-shrink-0 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  {q.points} درجة
                </span>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 mr-11">
                {CHOICE_LABELS.map((label) => {
                  const choiceText = q[`choice_${label.toLowerCase()}` as keyof Question] as string;
                  const isCorrect = q.correct_answer === label;
                  return (
                    <div
                      key={label}
                      className={`flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm ${
                        isCorrect
                          ? 'bg-green-50 border border-green-200 text-green-800 font-medium'
                          : 'bg-gray-50 border border-gray-100 text-gray-600'
                      }`}
                    >
                      <span className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCorrect ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                      }`}>
                        {isCorrect ? <Check className="h-3.5 w-3.5" /> : label}
                      </span>
                      <span>{choiceText}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
