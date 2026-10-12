import { useEffect, useState } from 'react';
import { CalendarClock, GraduationCap, LogOut, FileText, Clock, Calendar, CheckCircle2, AlertCircle, Play } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { PageLoader } from '@/components/Loader';
import { navigate } from '@/hooks/useRouter';
import {
  fetchActiveExams,
  fetchAttemptByStudentExam,
  fetchResumableExamAttempts,
  hasAttemptBeenSubmitted,
} from '@/services/attemptService';
import { fetchExamQuestions } from '@/services/attemptService';
import { signOutStudent } from '@/services/studentService';
import type { Student, Exam, ExamAttempt } from '@/types';

interface ExamWithMeta extends Exam {
  _questionCount?: number;
  _attempt?: ExamAttempt | null;
}

export function StudentAreaPage() {
  const [student, setStudent] = useState<Student | null>(null);
  const [exams, setExams] = useState<ExamWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('saifquiz_student');
    if (!stored) {
      navigate('/');
      return;
    }
    const s = JSON.parse(stored) as Student;
    setStudent(s);

    (async () => {
      try {
        const [activeExams, resumable] = await Promise.all([
          fetchActiveExams(),
          fetchResumableExamAttempts(s.id),
        ]);
        const resumableByExam = new Map(resumable.map(({ exam, attempt }) => [exam.id, attempt]));
        const examMap = new Map(activeExams.map((exam) => [exam.id, exam]));
        resumable.forEach(({ exam }) => examMap.set(exam.id, exam));
        const enriched = await Promise.all(
          [...examMap.values()].map(async (exam) => {
            const attempt = resumableByExam.get(exam.id)
              ?? await fetchAttemptByStudentExam(s.id, exam.id);
            const questions = await fetchExamQuestions(exam.id);
            return { ...exam, _questionCount: questions.length, _attempt: attempt } as ExamWithMeta;
          })
        );
        setExams(enriched);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'حدث خطأ أثناء تحميل الامتحانات');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleLogout = async () => {
    try {
      await signOutStudent();
      sessionStorage.removeItem('saifquiz_student');
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تسجيل الخروج');
    }
  };

  if (!student) return null;

  if (loading) return <PageLoader />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex flex-col">
      {/* Header */}
      <header className="px-6 py-5 border-b border-gray-100 bg-white sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-xl bg-gray-100 px-3 py-1.5">
              <GraduationCap className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 truncate max-w-[120px]">{student.full_name}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              خروج
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3 mb-6">
              <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}

          {/* No exams */}
          {exams.length === 0 && !error && (
            <div className="card p-12 text-center animate-scale-in">
              <div className="inline-flex h-20 w-20 rounded-3xl bg-gray-100 items-center justify-center text-gray-400 mb-6">
                <CalendarClock className="h-10 w-10" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">لا يوجد امتحان متاح حاليًا.</h1>
              <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
                سيظهر هنا أي امتحان مفعّل عند توفره. يرجى العودة لاحقاً.
              </p>
            </div>
          )}

          {/* Exam cards */}
          {exams.length > 0 && (
            <>
              <h2 className="text-lg font-bold text-gray-900 mb-1">الامتحانات المتاحة</h2>
              <p className="text-sm text-gray-500 mb-6">اختر امتحاناً للبدء</p>
              <div className="space-y-4">
                {exams.map((exam) => {
                  const attempt = exam._attempt;
                  const alreadySubmitted = attempt && hasAttemptBeenSubmitted(attempt.status);
                  const canStart = !attempt || attempt.status === 'not_started';
                  const canResume = attempt && attempt.status === 'in_progress';

                  return (
                    <div key={exam.id} className="card p-6 animate-slide-up">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        {/* Info */}
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700 flex-shrink-0">
                            <FileText className="h-6 w-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-gray-900 mb-1">{exam.title}</h3>
                            {exam.status !== 'active' && canResume && (
                              <p className="mb-2 text-xs font-medium text-amber-700">
                                الامتحان غير متاح لمحاولات جديدة، ويمكنك استكمال محاولتك الحالية.
                              </p>
                            )}
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
                              <span className="flex items-center gap-1">
                                <FileText className="h-3.5 w-3.5" />
                                {exam._questionCount ?? 0} سؤال
                              </span>
                              {exam.start_at && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {new Date(exam.start_at).toLocaleDateString('ar-EG')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action */}
                        <div className="flex-shrink-0">
                          {alreadySubmitted && (
                            <div className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-2.5 text-sm font-semibold text-green-700">
                              <CheckCircle2 className="h-4 w-4" />
                              تم التسليم
                            </div>
                          )}
                          {canStart && (
                            exam._questionCount === 0 ? (
                              <span className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-semibold text-gray-500">
                                لا يمكن البدء: لا توجد أسئلة
                              </span>
                            ) : (
                              <button
                                onClick={() => navigate(`/student/exam/${exam.id}/instructions`)}
                                className="btn-primary"
                              >
                                <Play className="h-4 w-4" />
                                <span>بدء الامتحان</span>
                              </button>
                            )
                          )}
                          {canResume && (
                            <button
                              onClick={() => navigate(`/student/exam/${exam.id}/run`)}
                              className="btn-primary"
                            >
                              <Play className="h-4 w-4" />
                              <span>استئناف الامتحان</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
