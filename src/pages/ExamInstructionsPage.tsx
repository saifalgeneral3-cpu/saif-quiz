import { useEffect, useState, useRef } from 'react';
import { ArrowRight, AlertTriangle, CheckCircle2, FileText, Clock, FileCheck, Camera, Mic, Video, X, Loader2 } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { navigate } from '@/hooks/useRouter';
import { fetchAttemptByStudentExam, fetchExamQuestions, createAttempt, startExistingAttempt, hasAttemptBeenSubmitted } from '@/services/attemptService';
import { fetchExamById } from '@/services/examService';
import type { Student, Exam, StudentQuestion, ExamAttempt } from '@/types';

interface InstructionsPageProps {
  examId: string;
}

type PermissionState = 'pending' | 'granted' | 'denied' | 'unsupported';

export function ExamInstructionsPage({ examId }: InstructionsPageProps) {
  const [student, setStudent] = useState<Student | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<StudentQuestion[]>([]);
  const [existingAttempt, setExistingAttempt] = useState<ExamAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [recordingAgreed, setRecordingAgreed] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<PermissionState>('pending');
  const [micPermission, setMicPermission] = useState<PermissionState>('pending');
  const [requestingPermissions, setRequestingPermissions] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const previewStreamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

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
        const [found, attempt] = await Promise.all([
          fetchExamById(examId),
          fetchAttemptByStudentExam(s.id, examId),
        ]);
        if (!found) {
          setError('هذا الامتحان غير متاح حالياً');
          setLoading(false);
          return;
        }
        setExam(found);
        if (!attempt || !hasAttemptBeenSubmitted(attempt.status)) {
          setQuestions(await fetchExamQuestions(examId));
        }
        setExistingAttempt(attempt);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'حدث خطأ أثناء تحميل الامتحان');
      } finally {
        setLoading(false);
      }
    })();
  }, [examId]);

  // Cleanup preview stream on unmount
  useEffect(() => {
    return () => {
      previewStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const requestPermissions = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraPermission('unsupported');
      setMicPermission('unsupported');
      return;
    }

    setRequestingPermissions(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });

      const hasVideo = stream.getVideoTracks().length > 0;
      const hasAudio = stream.getAudioTracks().length > 0;

      setCameraPermission(hasVideo ? 'granted' : 'denied');
      setMicPermission(hasAudio ? 'granted' : 'denied');

      if (hasVideo && videoPreviewRef.current) {
        previewStreamRef.current = stream;
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      } else {
        stream.getTracks().forEach((t) => t.stop());
      }

      if (hasVideo && hasAudio) {
        setPermissionsGranted(true);
        // Keep the preview stream alive — the runner page will re-acquire
        // We stop it here and the runner will request its own stream
        previewStreamRef.current?.getTracks().forEach((t) => t.stop());
        previewStreamRef.current = null;
      }
    } catch (err) {
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'SecurityError') {
          setCameraPermission('denied');
          setMicPermission('denied');
        }
      }
    } finally {
      setRequestingPermissions(false);
    }
  };

  const handleStart = async () => {
    if (!student || !exam) return;
    setStarting(true);
    setError(null);

    try {
      if (existingAttempt && hasAttemptBeenSubmitted(existingAttempt.status)) {
        setError('لقد قمت بتسليم هذا الامتحان بالفعل');
        setStarting(false);
        return;
      }

      if (existingAttempt && existingAttempt.status === 'not_started') {
        await startExistingAttempt(examId);
      } else if (existingAttempt && existingAttempt.status === 'in_progress') {
        // Resume existing in-progress attempt
      } else if (!existingAttempt) {
        await createAttempt(examId);
      }

      navigate(`/student/exam/${examId}/run`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ أثناء بدء الامتحان';
      if (msg.includes('unique_attempt_per_student_exam') || msg.includes('duplicate key')) {
        navigate(`/student/exam/${examId}/run`);
      } else {
        setError(msg);
      }
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <Logo size="sm" />
        <p className="mt-8 text-sm text-gray-500">جاري تحميل الامتحان...</p>
      </div>
    );
  }

  if (error || !exam) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <header className="px-6 py-5 border-b border-gray-100 bg-white">
          <div className="max-w-4xl mx-auto"><Logo size="sm" /></div>
        </header>
        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-md text-center">
            <div className="inline-flex h-16 w-16 rounded-2xl bg-red-100 items-center justify-center text-red-600 mb-4">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">تعذّر بدء الامتحان</h1>
            <p className="text-sm text-gray-500 mb-6">{error ?? 'حدث خطأ غير متوقع'}</p>
            <button onClick={() => navigate('/student')} className="btn-primary">
              العودة لمنطقة الطالب
            </button>
          </div>
        </main>
      </div>
    );
  }

  const totalPoints = questions.reduce((sum, q) => sum + Number(q.points), 0);

  if (existingAttempt && hasAttemptBeenSubmitted(existingAttempt.status)) {
    return (
      <div className="min-h-screen flex flex-col bg-gray-50">
        <header className="px-6 py-5 border-b border-gray-100 bg-white">
          <div className="max-w-4xl mx-auto"><Logo size="sm" /></div>
        </header>
        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="max-w-md text-center animate-scale-in">
            <div className="inline-flex h-16 w-16 rounded-2xl bg-green-100 items-center justify-center text-green-600 mb-4">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">تم تسليم الامتحان</h1>
            <p className="text-sm text-gray-500 mb-6">لقد قمت بتسليم هذا الامتحان بالفعل ولا يمكن إعادته.</p>
            <button onClick={() => navigate('/student')} className="btn-primary">
              العودة لمنطقة الطالب
            </button>
          </div>
        </main>
      </div>
    );
  }

  const permissionsBlocked = cameraPermission === 'denied' || micPermission === 'denied' || cameraPermission === 'unsupported' || micPermission === 'unsupported';

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex flex-col">
      {/* Header */}
      <header className="px-6 py-5 border-b border-gray-100 bg-white">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Logo size="sm" />
          <button
            onClick={() => navigate('/student')}
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <ArrowRight className="h-4 w-4" />
            رجوع
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-2xl mx-auto animate-slide-up">
          {/* Exam info */}
          <div className="card p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="h-14 w-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-700 flex-shrink-0">
                <FileText className="h-7 w-7" />
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-gray-900 mb-1">{exam.title}</h1>
                {exam.description && (
                  <p className="text-sm text-gray-500 leading-relaxed">{exam.description}</p>
                )}
                <div className="flex items-center gap-5 mt-4 text-sm text-gray-500 flex-wrap">
                  {exam.duration_minutes && (
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-4 w-4 text-gray-400" />
                      {exam.duration_minutes} دقيقة
                    </span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-gray-400" />
                    {questions.length} سؤال
                  </span>
                  <span className="flex items-center gap-1.5">
                    <FileCheck className="h-4 w-4 text-gray-400" />
                    {totalPoints} درجة
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Recording consent */}
          <div className="card p-6 mb-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 flex-shrink-0">
                <Video className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900 mb-2">مراقبة بالكاميرا والمايكروفون</h2>
                <p className="text-sm text-gray-700 leading-relaxed">
                  يتطلب هذا الامتحان الوصول إلى الكاميرا والمايكروفون لأغراض المراقبة.
                  سيتم تسجيل الفيديو والصوت طوال فترة الامتحان.
                </p>
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer mb-5">
              <input
                type="checkbox"
                checked={recordingAgreed}
                onChange={(e) => setRecordingAgreed(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-700 focus:ring-blue-500 focus:ring-2"
              />
              <span className="text-sm font-medium text-gray-700 leading-relaxed">
                أوافق على تسجيل الكاميرا والمايكروفون أثناء الامتحان وأعلم أن التسجيل سيكون متاحاً للإدارة لمراجعته.
              </span>
            </label>

            {/* Permission request button */}
            {recordingAgreed && !permissionsGranted && !permissionsBlocked && (
              <button
                onClick={requestPermissions}
                disabled={requestingPermissions}
                className="btn-primary w-full"
              >
                {requestingPermissions ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>جاري طلب الإذن...</span>
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4" />
                    <span>السماح بالوصول للكاميرا والمايكروفون</span>
                  </>
                )}
              </button>
            )}

            {/* Permission denied */}
            {(cameraPermission === 'denied' || micPermission === 'denied') && (
              <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 animate-fade-in">
                <div className="flex items-start gap-2">
                  <X className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-700 mb-1">تم رفض إذن الكاميرا أو المايكروفون</p>
                    <p className="text-xs text-red-600 leading-relaxed">
                      لا يمكن بدء الامتحان دون السماح بالوصول إلى الكاميرا والمايكروفون.
                      يرجى تحديث الصفحة والسماح بالإذن من المتصفح.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Unsupported */}
            {(cameraPermission === 'unsupported' || micPermission === 'unsupported') && (
              <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 animate-fade-in">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-700 mb-1">المتصفح لا يدعم التسجيل</p>
                    <p className="text-xs text-amber-600 leading-relaxed">
                      متصفحك لا يدعم الوصول إلى الكاميرا أو المايكروفون. يرجى استخدام متصفح حديث.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Permission granted preview */}
            {permissionsGranted && (
              <div className="space-y-3 animate-fade-in">
                <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-100 px-4 py-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                  <p className="text-sm font-semibold text-green-700">تم منح إذن الكاميرا والمايكروفون بنجاح</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Camera className="h-4 w-4 text-green-600" />
                    <span>الكاميرا: مفعّلة</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mic className="h-4 w-4 text-green-600" />
                    <span>المايكروفون: مفعّل</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Exam rules warning */}
          <div className="card p-6 mb-6 border-amber-200 bg-amber-50/50">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900 mb-2">تنبيه مهم</h2>
                <p className="text-sm text-gray-700 leading-relaxed">
                  يبدأ عداد الوقت من الخادم ولا يتوقف عند تحديث الصفحة أو إغلاقها.
                  يمكنك العودة إلى الامتحان قبل انتهاء الوقت، وستبقى الإجابات المحفوظة متاحة.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2.5 text-sm text-gray-600 bg-white/60 rounded-xl px-4 py-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
              <p>يتم حفظ إجاباتك تلقائياً عند اختيار كل إجابة.</p>
            </div>
          </div>

          {/* Agreement + start */}
          <div className="card p-6">
            <label className="flex items-start gap-3 cursor-pointer mb-5">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-gray-300 text-blue-700 focus:ring-blue-500 focus:ring-2"
              />
              <span className="text-sm font-medium text-gray-700 leading-relaxed">
                أوافق على شروط الامتحان وأؤكد أنني فهمت أن مغادرة الصفحة ستؤدي إلى تسليم الامتحان تلقائياً.
              </span>
            </label>

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3 mb-4 animate-fade-in">
                <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            )}

            <button
              onClick={handleStart}
              disabled={!agreed || !recordingAgreed || !permissionsGranted || starting}
              className="btn-primary w-full"
            >
              {starting ? (
                <span>جاري البدء...</span>
              ) : (
                <span>أوافق وأبدأ الامتحان</span>
              )}
            </button>

            {!permissionsGranted && (
              <p className="text-xs text-gray-400 text-center mt-3">
                يجب السماح بالكاميرا والمايكروفون قبل بدء الامتحان
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
