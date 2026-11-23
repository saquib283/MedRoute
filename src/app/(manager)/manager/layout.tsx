'use client';

/**
 * Afzal Healthcare — Manager Sidebar & Layout Container
 * Restrained clinical light-mode layout for coordinators.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import logoImg from '../../../../public/assets/logo.png';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { GlobalAlertBanner } from '@/components/ui/GlobalAlertBanner';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Home,
  Calendar,
  MessageSquare,
  Receipt,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [alertBannerText, setAlertBannerText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadUserData() {
      try {
        const res = await fetch('/api/v1/auth/me');
        if (res.status === 503) {
          if (!cancelled) router.push('/login?reason=maintenance');
          return;
        }
        if (res.ok) {
          const data = await res.json();
          // Authenticate role
          const role = data.data?.user?.role;
          if (role !== 'MANAGER' && role !== 'ADMIN') {
            if (!cancelled) router.push('/login');
            return;
          }
          if (!cancelled) {
            setUserName(data.data?.user?.fullName || 'Manager');
            setUserEmail(data.data?.user?.email);
            setAlertBannerText(data.data?.alertBannerText || '');
          }
        } else {
          if (!cancelled) router.push('/login');
        }
      } catch (err) {
        console.error('Failed to load manager info:', err);
        if (!cancelled) router.push('/login');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const timer = setTimeout(() => {
      void loadUserData();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
      router.push('/login');
    }
  };

  const navSections: NavSection[] = [
    {
      title: 'Care Workspace',
      items: [
        {
          label: 'Overview',
          href: '/manager/dashboard',
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          ),
        },
        {
          label: 'Patient Cohort',
          href: '/manager/patients',
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          ),
        },
        {
          label: 'Case Files',
          href: '/manager/cases',
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Operations & Travel',
      items: [
        {
          label: 'Appointments',
          href: '/manager/appointments',
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
        },
        {
          label: 'Patient Invoices',
          href: '/manager/billing',
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 14l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
        {
          label: 'Partner Hotels',
          href: '/manager/accommodations',
          icon: <Home className="w-5 h-5" />,
        },
      ],
    },
    {
      title: 'Communication',
      items: [
        {
          label: 'Chat Center',
          href: '/manager/chat',
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          ),
        },
      ],
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-surface-600">Verifying session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-surface-100 font-sans">
      {/* ─── Sidebar Navigation ────────────────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-surface-50 border-r border-surface-200/80
          flex flex-col justify-between transition-transform duration-200 lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:shrink-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div>
          {/* Logo Brand Header */}
          <div className="flex items-center px-6 h-16 border-b border-surface-200/60 bg-white">
            <Image src={logoImg} alt="Afzal Logo" width={110} height={36} className="h-9 w-auto object-contain shrink-0" priority />
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-6">
            {navSections.map((section) => (
              <div key={section.title} className="space-y-2">
                <span className="px-3 text-[11px] font-bold text-surface-400 uppercase tracking-widest block mb-2">
                  {section.title}
                </span>
                <div className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`
                          flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-md transition-colors duration-150
                          ${
                            isActive
                              ? 'bg-primary-50 text-primary-700'
                              : 'text-surface-600 hover:bg-surface-200/50 hover:text-surface-900'
                          }
                        `}
                        onClick={() => setIsSidebarOpen(false)}
                      >
                        <span className={isActive ? 'text-primary-600' : 'text-surface-400 group-hover:text-surface-600'}>
                          {item.icon}
                        </span>
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* User profile dropdown and Logout */}
        <div className="border-t border-surface-200/60 p-4 bg-white space-y-3">
          <div className="flex items-center gap-3 px-3 py-2 bg-surface-50 border border-surface-200/40 rounded-md">
            <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm shrink-0">
              {userName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-surface-900 truncate">{userName}</p>
              <p className="text-xs text-surface-500 truncate">{userEmail}</p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-surface-500 hover:text-surface-900 hover:bg-surface-100 rounded-md transition-colors text-left"
          >
            <svg className="w-5 h-5 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Backdrop for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-surface-900/20 backdrop-blur-xs lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ─── Viewport Area ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-surface-200/60 flex items-center justify-between px-4 sm:px-6 lg:px-8 z-10 shrink-0">
          <button
            className="p-1 text-surface-500 hover:text-surface-700 lg:hidden"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Toggle Navigation"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          {/* Enhanced Breadcrumb & Page Title Header */}
          <div className="flex items-center gap-3">
            {pathname === '/manager/dashboard' && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center font-bold">
                  <LayoutDashboard className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-primary-700 uppercase tracking-wider block mb-0.5">Coordinator Portal</span>
                  <h2 className="text-base font-bold text-surface-900 tracking-tight">Operations Overview</h2>
                </div>
              </div>
            )}

            {pathname === '/manager/patients' && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center font-bold">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-primary-700 uppercase tracking-wider block mb-0.5">Care Roster</span>
                  <h2 className="text-base font-bold text-surface-900 tracking-tight">Patient Cohort</h2>
                </div>
              </div>
            )}

            {pathname === '/manager/cases' && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center font-bold">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-primary-700 uppercase tracking-wider block mb-0.5">Clinical Cases</span>
                  <h2 className="text-base font-bold text-surface-900 tracking-tight">Case Pipeline Files</h2>
                </div>
              </div>
            )}


            {pathname === '/manager/appointments' && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-primary-700 uppercase tracking-wider block mb-0.5">Surgical Roster</span>
                  <h2 className="text-base font-bold text-surface-900 tracking-tight">Consultations & Surgery Schedule</h2>
                </div>
              </div>
            )}

            {pathname === '/manager/billing' && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center font-bold">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-primary-700 uppercase tracking-wider block mb-0.5">Billing & Invoices</span>
                  <h2 className="text-base font-bold text-surface-900 tracking-tight">Patient Billing & Settlement</h2>
                </div>
              </div>
            )}

            {pathname === '/manager/accommodations' && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center font-bold">
                  <Home className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-primary-700 uppercase tracking-wider block mb-0.5">Operations & Travel</span>
                  <h2 className="text-base font-bold text-surface-900 tracking-tight">Partner Hotels & Stays</h2>
                </div>
              </div>
            )}

            {pathname === '/manager/chat' && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center font-bold">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-primary-700 uppercase tracking-wider block mb-0.5">Patient Communication</span>
                  <h2 className="text-base font-bold text-surface-900 tracking-tight">Coordination Chat Center</h2>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <NotificationBell />
            <Link href="/manager/appointments">
              <Button size="sm">
                Book Appointment
              </Button>
            </Link>
          </div>
        </header>

        <GlobalAlertBanner text={alertBannerText} />

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
