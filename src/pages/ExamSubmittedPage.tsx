import { useEffect, useState } from 'react';
import { CheckCircle2, Home, LogOut, Award, TrendingUp, AlertCircle } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { navigate } from '@/hooks/useRouter';
import { fetchAttemptByStudentExam, hasAttemptBeenSubmitted } from '@/services/attemptService';
import { signOutStudent } from '@/services/studentService';
import type { Student, ExamAttempt } from '@/types';

interface ExamSubmittedPageProps {
  examId: string;
}

export function ExamSubmittedPage({ examId }: ExamSubmittedPageProps) {
  const [student, setStudent] = useState<Student | null>(null);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recordingUploadStatus, setRecordingUploadStatus] = useState<string | null>(null);

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
        const att = await fetchAttemptByStudentExam(s.id, examId);
        setAttempt(att);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'تعذّر تحميل نتيجة الامتحان');
      } finally {
        setLoading(false);
      }
    })();
  }, [examId]);

  useEffect(() => {
    if (!attempt) return;
    const key = `saifquiz_recording_upload_${attempt.id}`;
    const updateStatus = () => setRecordingUploadStatus(sessionStorage.getItem(key));
    updateStatus();
    const interval = window.setInterval(updateStatus, 500);
    return () => window.clearInterval(interval);
  }, [attempt]);

  const handleLogout = async () => {
    try {
      await signOutStudent();
      sessionStorage.removeItem('saifquiz_student');
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر تسجيل الخروج');
    }
  };

  const isAutoSubmitted = attempt?.status === 'auto_submitted';
  const hasSubmitted = attempt !== null && hasAttemptBeenSubmitted(attempt.status);
  const score = attempt?.score ?? 0;
  const maxScore = attempt?.max_score ?? 0;
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  const getGradeColor = (pct: number) => {
    if (pct >= 90) return { bg: 'bg-green-100', text: 'text-green-700', ring: 'text-green-600' };
    if (pct >= 70) return { bg: 'bg-blue-100', text: 'text-blue-700', ring: 'text-blue-600' };
    if (pct >= 50) return { bg: 'bg-amber-100', text: 'text-amber-700', ring: 'text-amber-600' };
    return { bg: 'bg-red-100', text: 'text-red-700', ring: 'text-red-600' };
  };

  const gradeColors = getGradeColor(percentage);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex flex-col">
      <header className="px-6 py-5 border-b border-gray-100 bg-white">
        <div className="max-w-4xl mx-auto"><Logo size="sm" /></div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md animate-scale-in">
          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 mb-5 text-sm font-medium text-red-700">
              {error}
            </div>
          )}
          {!loading && !attempt && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 mb-5 text-sm font-medium text-amber-800">
              لم نتمكن من تأكيد تسليم الامتحان أو تحميل نتيجته. لا تعرض الصفحة نتيجة غير مؤكدة.
            </div>
          )}
          {/* Success icon */}
          <div className="text-center mb-6">
            <div className={`inline-flex h-20 w-20 rounded-3xl items-center justify-center mb-4 ${
              hasSubmitted ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-700'
            }`}>
              {hasSubmitted ? <CheckCircle2 className="h-10 w-10" /> : <AlertCircle className="h-10 w-10" />}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {hasSubmitted
                ? isAutoSubmitted ? 'تم تسليم الامتحان تلقائياً' : 'تم تسليم الامتحان بنجاح'
                : attempt ? 'المحاولة لم تُسلّم بعد' : 'حالة تسليم الامتحان غير مؤكدة'}
            </h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              {hasSubmitted
                ? isAutoSubmitted
                  ? 'تم تسليم امتحانك تلقائياً. تم حفظ الإجابات التي وصلت إلى الخادم.'
                  : 'تم تسليم إجاباتك وتصحيحها.'
                : attempt
                  ? 'لا توجد نتيجة نهائية بعد. عُد إلى منطقة الطالب لاستكمال المحاولة قبل انتهاء الوقت.'
                  : 'تحقق من اتصالك بالإنترنت وأعد تحميل الصفحة للتحقق من حالة المحاولة.'}
            </p>
            {student && (
              <p className="text-sm text-gray-400 mt-2">شكراً {student.full_name}</p>
            )}
          </div>

          {/* Results card — only show if grading completed */}
          {hasSubmitted && attempt && attempt.score !== null && attempt.max_score !== null && (
            <div className="card p-8 mb-6">
              {/* Score circle */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative h-32 w-32">
                  <svg className="h-32 w-32 -rotate-90" viewBox="0 0 128 128">
                    <circle
                      cx="64" cy="64" r="56"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="10"
                      className="text-gray-100"
                    />
                    <circle
                      cx="64" cy="64" r="56"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 56}`}
                      strokeDashoffset={`${2 * Math.PI * 56 * (1 - percentage / 100)}`}
                      className={gradeColors.ring}
                      style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-3xl font-bold ${gradeColors.text}`}>{percentage}%</span>
                  </div>
                </div>
              </div>

              {/* Score breakdown */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-gray-50 p-4 text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Award className="h-5 w-5 text-gray-400" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{score}</p>
                  <p className="text-xs text-gray-500 mt-1">درجتك</p>
                </div>
                <div className="rounded-xl bg-gray-50 p-4 text-center">
                  <div className="flex items-center justify-center mb-2">
                    <TrendingUp className="h-5 w-5 text-gray-400" />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{maxScore}</p>
                  <p className="text-xs text-gray-500 mt-1">الدرجة العظمى</p>
                </div>
              </div>

              {/* Score line */}
              <div className="mt-6 text-center">
                <p className="text-lg font-bold text-gray-900">
                  {score} / {maxScore}
                </p>
                <p className="text-sm text-gray-500 mt-1">{percentage}%</p>
              </div>
            </div>
          )}

          {/* Pending grading state */}
          {hasSubmitted && attempt && attempt.score === null && (
            <div className="card p-8 mb-6 text-center">
              <div className="inline-flex h-12 w-12 rounded-xl bg-gray-100 items-center justify-center text-gray-400 mb-3">
                <Award className="h-6 w-6" />
              </div>
              <p className="text-sm text-gray-500">سيتم تصحيح الامتحان قريباً</p>
            </div>
          )}

          {hasSubmitted && recordingUploadStatus && (
            <div
              className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
                recordingUploadStatus === 'uploaded'
                  ? 'border-green-100 bg-green-50 text-green-800'
                  : recordingUploadStatus === 'failed'
                    ? 'border-red-100 bg-red-50 text-red-700'
                    : 'border-blue-100 bg-blue-50 text-blue-800'
              }`}
              role="status"
            >
              {recordingUploadStatus === 'uploaded'
                ? 'تم حفظ التسجيل بنجاح.'
                : recordingUploadStatus === 'failed'
                  ? 'تعذّر حفظ التسجيل. يرجى إبلاغ الإدارة.'
                  : `ما زال التسجيل يُرفع${recordingUploadStatus.startsWith('uploading:') ? ` — ${recordingUploadStatus.split(':')[1]}%` : ''}. اترك هذه الصفحة مفتوحة حتى يكتمل.`}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <button onClick={() => navigate('/student')} className="btn-primary w-full">
              <Home className="h-4 w-4" />
              <span>العودة لمنطقة الطالب</span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors flex items-center justify-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              تسجيل الخروج
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
