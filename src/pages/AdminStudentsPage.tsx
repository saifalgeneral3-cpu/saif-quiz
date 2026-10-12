import { useEffect, useState } from 'react';
import { Users, Search, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { fetchAllStudentsWithStats, type StudentWithStats } from '@/services/studentService';

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

export function AdminStudentsPage() {
  const [students, setStudents] = useState<StudentWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchAllStudentsWithStats();
        setStudents(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'حدث خطأ أثناء تحميل الطلاب');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filteredStudents = searchQuery
    ? students.filter((s) =>
        s.student.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.student.phone.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : students;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card p-12 text-center animate-scale-in">
        <div className="inline-flex h-16 w-16 rounded-2xl bg-red-100 items-center justify-center text-red-600 mb-4">
          <AlertCircle className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">تعذّر تحميل الطلاب</h2>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Search */}
      <div className="card p-4">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو الهاتف..."
            className="input-field pr-11"
          />
        </div>
      </div>

      {/* Students */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-400" />
            <h2 className="font-bold text-gray-900">الطلاب</h2>
          </div>
          <span className="text-sm text-gray-400">{filteredStudents.length} طالب</span>
        </div>

        {filteredStudents.length === 0 && (
          <div className="p-12 text-center">
            <div className="inline-flex h-16 w-16 rounded-2xl bg-gray-100 items-center justify-center text-gray-400 mb-4">
              <Users className="h-8 w-8" />
            </div>
            <p className="text-sm text-gray-500">
              {searchQuery ? 'لا توجد نتائج مطابقة' : 'لا يوجد طلاب مسجلون بعد'}
            </p>
          </div>
        )}

        {filteredStudents.length > 0 && (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-gray-400 text-xs">
                    <th className="px-6 py-3 text-right font-medium">الاسم</th>
                    <th className="px-6 py-3 text-right font-medium">الهاتف</th>
                    <th className="px-6 py-3 text-center font-medium">عدد المحاولات</th>
                    <th className="px-6 py-3 text-center font-medium">آخر درجة</th>
                    <th className="px-6 py-3 text-right font-medium">آخر نشاط</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((s) => (
                    <tr key={s.student.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-700 font-bold text-xs">
                            {s.student.full_name.charAt(0)}
                          </div>
                          <span className="font-medium text-gray-900">{s.student.full_name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-gray-500" dir="ltr">{s.student.phone}</td>
                      <td className="px-6 py-3 text-center font-semibold text-gray-900">{s.attemptCount}</td>
                      <td className="px-6 py-3 text-center">
                        {s.latestPercentage !== null ? (
                          <span className={`font-bold ${s.latestPercentage >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                            {s.latestScore} / {s.latestMaxScore} ({s.latestPercentage}%)
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-gray-500 text-xs flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                        {formatDateTime(s.lastActivity)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="lg:hidden divide-y divide-gray-50">
              {filteredStudents.map((s) => (
                <div key={s.student.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center text-blue-700 font-bold text-sm">
                        {s.student.full_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{s.student.full_name}</p>
                        <p className="text-xs text-gray-400" dir="ltr">{s.student.phone}</p>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-gray-50 py-2">
                      <p className="text-sm font-bold text-gray-900">{s.attemptCount}</p>
                      <p className="text-xs text-gray-400">محاولات</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 py-2">
                      {s.latestPercentage !== null ? (
                        <>
                          <p className={`text-sm font-bold ${s.latestPercentage >= 50 ? 'text-green-600' : 'text-red-600'}`}>
                            {s.latestPercentage}%
                          </p>
                          <p className="text-xs text-gray-400">آخر درجة</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-bold text-gray-300">—</p>
                          <p className="text-xs text-gray-400">آخر درجة</p>
                        </>
                      )}
                    </div>
                    <div className="rounded-lg bg-gray-50 py-2">
                      <p className="text-xs font-medium text-gray-700">{formatDateTime(s.lastActivity)}</p>
                      <p className="text-xs text-gray-400">آخر نشاط</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
