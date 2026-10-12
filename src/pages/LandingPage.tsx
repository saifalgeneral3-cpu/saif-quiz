import { ShieldCheck, UserPlus, ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { navigate } from '@/hooks/useRouter';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="px-6 py-5 border-b border-gray-100">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Logo size="sm" />
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-5xl">
          {/* Hero */}
          <div className="text-center mb-12 animate-fade-in">
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-xs font-semibold text-blue-700 mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
              </span>
              منصة اختبارات احترافية
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4 leading-tight">
              مرحباً بك في <span className="text-blue-700">SaifQuiz</span>
            </h1>
            <p className="text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
              منصة الاختبارات الإلكترونية — نظام متكامل لإدارة الامتحانات والمراقبة والتقييم
            </p>
          </div>

          {/* Entry cards */}
          <div className="grid md:grid-cols-2 gap-6 animate-slide-up">
            {/* Admin entry */}
            <button
              onClick={() => navigate('/admin/login')}
              className="group card p-8 text-right transition-all hover:shadow-card-hover hover:border-blue-200 hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="h-14 w-14 rounded-2xl bg-blue-700 flex items-center justify-center text-white shadow-sm group-hover:scale-110 transition-transform">
                  <ShieldCheck className="h-7 w-7" />
                </div>
                <ArrowLeft className="h-5 w-5 text-gray-300 group-hover:text-blue-600 group-hover:-translate-x-1 transition-all" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">دخول الأدمن</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                لوحة تحكم المدرّس والإدارة — إنشاء الامتحانات وإدارة الطلاب وعرض النتائج والتسجيلات
              </p>
            </button>

            {/* Student entry */}
            <button
              onClick={() => navigate('/enter')}
              className="group card p-8 text-right transition-all hover:shadow-card-hover hover:border-blue-200 hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between mb-6">
                <div className="h-14 w-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-700 shadow-sm group-hover:scale-110 transition-transform">
                  <UserPlus className="h-7 w-7" />
                </div>
                <ArrowLeft className="h-5 w-5 text-gray-300 group-hover:text-blue-600 group-hover:-translate-x-1 transition-all" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 mb-2">دخول الطالب</h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                أدخل بياناتك للمشاركة في الامتحانات — الاسم الثلاثي ورقم الهاتف فقط
              </p>
            </button>
          </div>

          {/* Feature pills */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-3 animate-fade-in">
            {['مراقبة بالكاميرا', 'تصحيح تلقائي', 'مؤقت ذكي', 'تقارير تفصيلية'].map((feature) => (
              <span
                key={feature}
                className="rounded-full bg-white border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600"
              >
                {feature}
              </span>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6 border-t border-gray-100">
        <div className="max-w-6xl mx-auto text-center text-xs text-gray-400">
          SaifQuiz — منصة الاختبارات الإلكترونية
        </div>
      </footer>
    </div>
  );
}
