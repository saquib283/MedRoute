'use client';

/**
 * Afzal Healthcare — Doctor Portal Shell
 * Unified 240px sidebar, 56px hairline-aligned header bar, and max-w-6xl content alignment.
 */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import logoImg from '../../../../public/assets/logo.png';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Calendar,
  Users,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { formatDoctorDisplayName } from '@/lib/validation/booking-helpers';
import { GlobalAlertBanner } from '@/components/ui/GlobalAlertBanner';
import { NotificationBell } from '@/components/notifications/NotificationBell';

interface NavItem {
  label: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/doctor/dashboard', Icon: LayoutDashboard },
  { label: 'Appointments', href: '/doctor/appointments', Icon: Calendar },
  { label: 'My Patients', href: '/doctor/patients', Icon: Users },
];

export default function DoctorLayout({
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
        if (!res.ok) {
          if (!cancelled) router.push('/login');
          return;
        }
        const data = await res.json();
        const user = data.data?.user;
        if (user?.role !== 'DOCTOR') {
          if (!cancelled) router.push('/login');
          return;
        }
        if (!cancelled) {
          setUserName(formatDoctorDisplayName(user.fullName || 'Doctor'));
          setUserEmail(user.email || '');
          setAlertBannerText(data.data?.alertBannerText || '');
        }
      } catch (err) {
        console.error('Failed to load doctor info:', err);
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
    } catch (err) {
      console.error('Logout failed:', err);
    } finally {
      router.push('/login');
    }
  };

  const activeLabel = useMemo(() => {
    if (pathname.startsWith('/doctor/cases/')) return 'Case Review & Clearance';
    return NAV_ITEMS.find((item) => item.href === pathname)?.label || 'Overview';
  }, [pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-xs text-surface-600">
          <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <span>Verifying specialist session…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-surface-100 font-sans">
      {/* ─── Sidebar Navigation (240px) ────────────────────────────────── */}
      <aside
        aria-label="Specialist navigation"
        className={`
          fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-surface-200
          flex flex-col justify-between transition-transform duration-150 ease-out
          lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:shrink-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col min-h-0 flex-1">
          <div className="flex items-center justify-between px-4 h-14 border-b border-surface-200 bg-white shrink-0">
            <Link
              href="/doctor/dashboard"
              onClick={() => setIsSidebarOpen(false)}
              className="inline-flex items-center min-h-11 px-1 rounded-md"
            >
              <Image
                src={logoImg}
                alt="Afzal Healthcare"
                width={108}
                height={32}
                className="h-7 w-auto object-contain shrink-0"
                priority
              />
            </Link>

            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              aria-label="Close navigation menu"
              className="inline-flex lg:hidden items-center justify-center w-11 h-11 -mr-1.5 rounded-md text-surface-500 hover:text-surface-900 hover:bg-surface-100"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          <nav className="p-3 space-y-5 overflow-y-auto flex-1">
            <div className="space-y-1">
              <p className="px-2.5 text-[11px] font-medium text-surface-400 uppercase tracking-wide mb-1.5">
                Clinical Workspace
              </p>
              <div className="space-y-0.5">
                {NAV_ITEMS.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== '/doctor/dashboard' && pathname.startsWith(item.href)) ||
                    (item.href === '/doctor/patients' && pathname.startsWith('/doctor/cases/'));
                  const ItemIcon = item.Icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`
                        flex items-center gap-2.5 px-2.5 min-h-11 text-xs font-medium rounded-md transition-colors duration-150
                        ${
                          isActive
                            ? 'bg-primary-50/90 text-primary-900 border border-primary-200/80'
                            : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900 border border-transparent'
                        }
                      `}
                    >
                      <ItemIcon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-primary-700' : 'text-surface-400'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>
        </div>

        <div className="border-t border-surface-200 p-3 bg-surface-50/60 space-y-1.5 shrink-0">
          <div className="flex items-center gap-2.5 px-2.5 py-2 bg-white border border-surface-200 rounded-md">
            <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-800 border border-primary-200 flex items-center justify-center font-semibold text-xs shrink-0">
              {userName.replace(/^Dr\.\s*/i, '').charAt(0) || 'D'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-surface-900 truncate" title={userName}>
                {userName}
              </p>
              <p className="text-[11px] text-surface-500 truncate" title={userEmail}>
                {userEmail}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="w-full flex items-center gap-2.5 px-2.5 min-h-11 text-xs font-medium text-surface-600 hover:text-surface-900 hover:bg-surface-200/60 rounded-md transition-colors text-left"
          >
            <LogOut className="w-4 h-4 text-surface-400 shrink-0" aria-hidden="true" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {isSidebarOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-surface-900/30 lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ─── Main Viewport Area ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 min-h-14 bg-white border-b border-surface-200 flex items-center px-4 sm:px-6 lg:px-8 shrink-0">
          <div className="max-w-6xl mx-auto w-full flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                className="inline-flex lg:hidden items-center justify-center w-11 h-11 -ml-2 rounded-md text-surface-600 hover:text-surface-900 hover:bg-surface-100"
                onClick={() => setIsSidebarOpen(true)}
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" aria-hidden="true" />
              </button>

              <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs min-w-0">
                <Link
                  href="/doctor/dashboard"
                  className="hidden sm:inline-flex items-center min-h-11 px-1.5 rounded-md text-surface-500 hover:text-surface-900 transition-colors shrink-0"
                >
                  Specialist Portal
                </Link>
                <ChevronRight
                  className="hidden sm:block w-3.5 h-3.5 text-surface-400 shrink-0"
                  aria-hidden="true"
                />
                <span className="font-medium text-surface-900 truncate">{activeLabel}</span>
              </nav>
            </div>

            <div className="flex items-center gap-2.5 text-xs shrink-0">
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-surface-100 text-surface-700 border border-surface-200 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-success-600" aria-hidden="true" />
                Attending Physician
              </span>
              <NotificationBell />
            </div>
          </div>
        </header>

        <GlobalAlertBanner text={alertBannerText} />

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 min-w-0">
          <div className="max-w-6xl mx-auto w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
