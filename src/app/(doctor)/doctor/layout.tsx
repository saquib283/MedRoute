'use client';

/**
 * Afzal Healthcare — Doctor Portal Sidebar & Layout Container
 * Restrained clinical light-mode layout for treating specialists.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import logoImg from '../../../../public/assets/logo.png';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Calendar,
  Users,
  Stethoscope,
  LogOut,
  Menu,
} from 'lucide-react';
import { formatDoctorDisplayName } from '@/lib/validation/booking-helpers';
import { GlobalAlertBanner } from '@/components/ui/GlobalAlertBanner';
import { NotificationBell } from '@/components/notifications/NotificationBell';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

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

  const navItems: NavItem[] = [
    {
      label: 'Overview',
      href: '/doctor/dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      label: 'Appointments',
      href: '/doctor/appointments',
      icon: <Calendar className="w-5 h-5" />,
    },
    {
      label: 'My Patients',
      href: '/doctor/patients',
      icon: <Users className="w-5 h-5" />,
    },
  ];

  const getHeaderMeta = () => {
    if (pathname === '/doctor/appointments') {
      return {
        eyebrow: 'Clinical Schedule',
        title: 'Consultations & Surgical Encounters',
        icon: <Calendar className="w-4 h-4" />,
      };
    }
    if (pathname === '/doctor/patients') {
      return {
        eyebrow: 'Clinical Roster',
        title: 'My Patients & Safety Alerts',
        icon: <Users className="w-4 h-4" />,
      };
    }
    if (pathname.startsWith('/doctor/cases/')) {
      return {
        eyebrow: 'Case Workspace',
        title: 'Clinical Pathway & Fit-to-Fly Clearance',
        icon: <Stethoscope className="w-4 h-4" />,
      };
    }
    return {
      eyebrow: 'Doctor Portal',
      title: 'Specialist Clinical Overview',
      icon: <LayoutDashboard className="w-4 h-4" />,
    };
  };

  const headerMeta = getHeaderMeta();

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-surface-600">Verifying physician session...</span>
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
          <div className="flex items-center justify-between px-6 h-16 border-b border-surface-200/60 bg-white">
            <Image
              src={logoImg}
              alt="Afzal Healthcare Logo"
              width={110}
              height={36}
              className="h-9 w-auto object-contain shrink-0"
              priority
            />
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-200">
              Doctor
            </span>
          </div>

          <nav className="p-4 space-y-6">
            <div className="space-y-2">
              <span className="px-3 text-[11px] font-bold text-surface-400 uppercase tracking-widest block mb-2">
                Clinical Workspace
              </span>
              <div className="space-y-1">
                {navItems.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== '/doctor/dashboard' && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-md transition-colors duration-150
                        ${
                          isActive
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-surface-600 hover:bg-surface-200/50 hover:text-surface-900'
                        }
                      `}
                    >
                      <span className={isActive ? 'text-primary-600' : 'text-surface-400'}>
                        {item.icon}
                      </span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </nav>
        </div>

        {/* Physician Profile & Sign Out */}
        <div className="border-t border-surface-200/60 p-4 bg-white space-y-3">
          <div className="flex items-center gap-3 px-3 py-2 bg-surface-50 border border-surface-200/40 rounded-md">
            <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-sm shrink-0">
              {userName.replace(/^Dr\.\s*/i, '').charAt(0) || 'D'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-surface-900 truncate" title={userName}>
                {userName}
              </p>
              <p className="text-xs text-surface-500 truncate" title={userEmail}>
                {userEmail}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void handleLogout()}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold text-surface-500 hover:text-surface-900 hover:bg-surface-100 rounded-md transition-colors text-left"
          >
            <LogOut className="w-5 h-5 text-surface-400" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-surface-900/20 backdrop-blur-xs lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ─── Main Viewport ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 bg-white border-b border-surface-200/60 flex items-center justify-between px-4 sm:px-6 lg:px-8 z-10 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="p-1.5 text-surface-500 hover:text-surface-700 rounded-lg lg:hidden"
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Toggle Navigation"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center font-bold shrink-0">
                {headerMeta.icon}
              </div>
              <div>
                <span className="text-xs font-bold text-primary-700 uppercase tracking-wider block mb-0.5">
                  {headerMeta.eyebrow}
                </span>
                <h2 className="text-base font-bold text-surface-900 tracking-tight">
                  {headerMeta.title}
                </h2>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-surface-500">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Attending Specialist
            </span>
            <NotificationBell />
          </div>
        </header>

        <GlobalAlertBanner text={alertBannerText} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
