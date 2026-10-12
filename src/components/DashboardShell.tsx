import { type ReactNode } from 'react';
import { Home, FileText, BarChart3, Users, LogOut, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { LogoMark, AdminBadge } from '@/components/Logo';
import { signOutAdmin } from '@/services/authService';
import { navigate } from '@/hooks/useRouter';
import type { Admin } from '@/types';

interface DashboardShellProps {
  admin: Admin;
  activeSection: string;
  onNavigate: (section: string) => void;
  title?: string;
  children: ReactNode;
}

const NAV_ITEMS = [
  { id: 'home', label: 'الرئيسية', icon: Home },
  { id: 'exams', label: 'الامتحانات', icon: FileText },
  { id: 'results', label: 'النتائج', icon: BarChart3 },
  { id: 'students', label: 'الطلاب', icon: Users },
];

const SECTION_LABELS: Record<string, string> = {
  home: 'الرئيسية',
  exams: 'الامتحانات',
  results: 'النتائج',
  students: 'الطلاب',
};

export function DashboardShell({ admin, activeSection, onNavigate, title, children }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOutAdmin();
    navigate('/');
  };

  const headerTitle = title ?? SECTION_LABELS[activeSection] ?? '';

  return (
    <div className="min-h-screen bg-gray-50 flex" dir="rtl">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900/40 z-30 lg:hidden animate-fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:sticky top-0 right-0 h-screen w-72 bg-white border-l border-gray-100 z-40 flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoMark size="sm" />
            <span className="text-lg font-bold text-gray-900">
              Saif<span className="text-blue-700">Quiz</span>
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <p className="px-4 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">القائمة</p>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeSection;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onNavigate(item.id);
                  setSidebarOpen(false);
                }}
                className={`sidebar-link w-full ${isActive ? 'sidebar-link-active' : ''}`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Admin info */}
        <div className="px-4 py-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm flex-shrink-0">
              {(admin.full_name || admin.email).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {admin.full_name || 'أدمن'}
              </p>
              <p className="text-xs text-gray-400 truncate" dir="ltr">{admin.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="sidebar-link w-full mt-2 text-red-600 hover:bg-red-50 hover:text-red-700"
          >
            <LogOut className="h-5 w-5" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-sm border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-600 hover:text-gray-900"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">{headerTitle}</h1>
          </div>
          <AdminBadge size="sm" />
        </header>

        {/* Content area */}
        <main className="flex-1 p-6">
          <div className="max-w-6xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
