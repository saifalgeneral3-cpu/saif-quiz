import { useState } from 'react';
import { User, Phone, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ButtonLoader } from '@/components/Loader';
import {
  findOrCreateStudent,
  normalizeStudentPhone,
} from '@/services/studentService';
import { navigate } from '@/hooks/useRouter';
import type { Student } from '@/types';

const ARABIC_NAME_PATTERN = /^[\u0621-\u064A\s]+$/;

function validateFullName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return 'الاسم مطلوب';
  if (!ARABIC_NAME_PATTERN.test(trimmed)) return 'يجب أن يحتوي الاسم على أحرف عربية فقط';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length < 3) return 'يجب أن يحتوي الاسم على ثلاثة أجزاء على الأقل (الاسم الثلاثي)';
  return null;
}

function validatePhone(phone: string): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return 'رقم الهاتف مطلوب';
  if (!/^[+\d\s().-]+$/.test(trimmed)) return 'رقم الهاتف غير صالح';
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return 'رقم الهاتف غير صالح';
  return null;
}

export function StudentEntryPage() {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const nameError = validateFullName(fullName);
    const phoneError = validatePhone(phone);

    setErrors({ name: nameError ?? undefined, phone: phoneError ?? undefined });

    if (nameError || phoneError) return;

    setLoading(true);

    try {
      const normalizedPhone = normalizeStudentPhone(phone);
      if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) {
        setErrors({ phone: 'رقم الهاتف غير صالح. أدخل الرقم مع رمز الدولة أو بصيغة عراقية' });
        return;
      }

      const result = await findOrCreateStudent(fullName.trim(), normalizedPhone);
      setStudent(result);
      setSuccess(true);
      // Store student session in sessionStorage for the student area
      sessionStorage.setItem('saifquiz_student', JSON.stringify(result));
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ البيانات. يرجى المحاولة مرة أخرى'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleProceed = () => {
    navigate('/student');
  };

  if (success && student) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex flex-col">
        <header className="px-6 py-5 border-b border-gray-100">
          <div className="max-w-6xl mx-auto">
            <Logo size="sm" />
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md animate-scale-in text-center">
            <div className="inline-flex h-16 w-16 rounded-2xl bg-green-100 items-center justify-center text-green-600 mb-6">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">تم تسجيل بياناتك بنجاح</h1>
            <p className="text-sm text-gray-500 mb-1">مرحباً {student.full_name}</p>
            <p className="text-xs text-gray-400 mb-8">تم حفظ بياناتك في النظام</p>

            <button onClick={handleProceed} className="btn-primary w-full">
              <span>المتابعة لمنطقة الطالب</span>
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex flex-col">
      <header className="px-6 py-5 border-b border-gray-100">
        <div className="max-w-6xl mx-auto">
          <Logo size="sm" />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md animate-scale-in">
          {/* Title */}
          <div className="text-center mb-8">
            <div className="inline-flex h-16 w-16 rounded-2xl bg-gray-100 items-center justify-center text-gray-700 mb-4">
              <User className="h-8 w-8" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">دخول الطالب</h1>
            <p className="text-sm text-gray-500">أدخل بياناتك للمشاركة في الامتحانات</p>
            <p className="text-xs text-gray-400 mt-2">لن نرسل رمز تحقق؛ رقم الهاتف يُحفظ كما أدخلته</p>
          </div>

          {/* Form card */}
          <div className="card p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Full name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  الاسم الثلاثي
                </label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value);
                      if (errors.name) setErrors({ ...errors, name: undefined });
                    }}
                    placeholder="مثال: محمد أحمد علي"
                    required
                    className="input-field pr-11"
                  />
                </div>
                {errors.name && (
                  <p className="mt-2 text-xs text-red-600 font-medium flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  رقم الهاتف
                </label>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      if (errors.phone) setErrors({ ...errors, phone: undefined });
                    }}
                    placeholder="+9647XXXXXXXXX"
                    required
                    dir="ltr"
                    className="input-field pr-11 text-left"
                  />
                </div>
                {errors.phone && (
                  <p className="mt-2 text-xs text-red-600 font-medium flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {errors.phone}
                  </p>
                )}
              </div>

              {/* Submit error */}
              {submitError && (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3 animate-fade-in">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700 font-medium">{submitError}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
              >
                {loading ? (
                  <ButtonLoader />
                ) : (
                  <span>
                    تسجيل الدخول
                  </span>
                )}
              </button>
            </form>
          </div>

          {/* Back link */}
          <button
            onClick={() => navigate('/')}
            className="mt-6 w-full text-center text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
          >
            العودة للصفحة الرئيسية
          </button>
        </div>
      </main>
    </div>
  );
}
