'use client';

/**
 * Afzal Healthcare — Patient Portal Shell
 * Unified 240px sidebar, 56px hairline-aligned header bar, and max-w-6xl content alignment.
 */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import logoImg from '../../../../public/assets/logo.png';
import { usePathname, useRouter } from 'next/navigation';
import { GlobalAlertBanner } from '@/components/ui/GlobalAlertBanner';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { CurrencySelector } from '@/components/ui/CurrencySelector';
import { PatientSessionContext } from './patient-session-context';
import {
  LayoutDashboard,
  Milestone,
  AlertTriangle,
  Shield,
  User,
  Calendar,
  FolderLock,
  MessageSquare,
  Receipt,
  Building2,
  LogOut,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';

interface NavItem {
  label: string;
  shortLabel: string;
  href: string;
  Icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Care Journey',
    items: [
      {
        label: 'Overview',
        shortLabel: 'Overview',
        href: '/patient/dashboard',
        Icon: LayoutDashboard,
      },
      {
        label: 'Journey Timeline',
        shortLabel: 'Journey',
        href: '/patient/journey',
        Icon: Milestone,
      },
      {
        label: 'Appointments',
        shortLabel: 'Appointments',
        href: '/patient/appointments',
        Icon: Calendar,
      },
      {
        label: 'Billing & Receipts',
        shortLabel: 'Billing',
        href: '/patient/billing',
        Icon: Receipt,
      },
      {
        label: 'Recovery Stays',
        shortLabel: 'Recovery Stays',
        href: '/patient/accommodations',
        Icon: Building2,
      },
    ],
  },
  {
    title: 'Records & Support',
    items: [
      {
        label: 'Document Vault',
        shortLabel: 'Documents',
        href: '/patient/documents',
        Icon: FolderLock,
      },
      {
        label: 'Medical Profile',
        shortLabel: 'Profile',
        href: '/patient/profile',
        Icon: User,
      },
      {
        label: 'Coordinator Chat',
        shortLabel: 'Messages',
        href: '/patient/messages',
        Icon: MessageSquare,
      },
      {
        label: 'Grievances & SLA',
        shortLabel: 'Grievance',
        href: '/patient/grievance',
        Icon: AlertTriangle,
      },
      {
        label: 'Privacy & Data Rights',
        shortLabel: 'Privacy',
        href: '/patient/privacy',
        Icon: Shield,
      },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [isUserLoading, setIsUserLoading] = useState(true);
  const [alertBannerText, setAlertBannerText] = useState('');

  useEffect(() => {
    let cancelled = false;

    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/v1/auth/me');
        if (res.status === 503) {
          if (!cancelled) router.push('/login?reason=maintenance');
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.success && data.data?.user) {
          setUserId(data.data.user.id || null);
          setUserName(data.data.user.fullName || '');
          setUserEmail(data.data.user.email || '');
          setAlertBannerText(data.data?.alertBannerText || '');
        }
      } catch (err) {
        console.error('Failed to load profile in layout', err);
      } finally {
        if (!cancelled) {
          setIsUserLoading(false);
        }
      }
    };

    const timer = setTimeout(() => {
      void fetchProfile();
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [router]);

  useEffect(() => {
    if (!isSidebarOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSidebarOpen]);

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error', err);
    } finally {
      router.push('/login');
    }
  };

  const activeNavItem = useMemo(
    () => ALL_NAV_ITEMS.find((item) => item.href === pathname) || ALL_NAV_ITEMS[0],
    [pathname]
  );

  const sessionValue = useMemo(
    () => ({
      userId,
      fullName: userName,
      email: userEmail,
      isLoading: isUserLoading,
    }),
    [userId, userName, userEmail, isUserLoading]
  );

  const userInitial = userName ? userName.trim().charAt(0).toUpperCase() : 'P';

  return (
    <PatientSessionContext.Provider value={sessionValue}>
      <div className="min-h-screen flex bg-surface-100 font-sans">
        {/* ─── Sidebar Navigation (240px) ────────────────────────────────── */}
        <aside
          aria-label="Patient portal navigation"
          className={`
            fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-surface-200
            flex flex-col justify-between transition-transform duration-150 ease-out
            lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:shrink-0
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          `}
        >
          <div className="flex flex-col min-h-0 flex-1">
            {/* 56px Brand Header — Hairline aligned with top bar */}
            <div className="flex items-center justify-between px-4 h-14 border-b border-surface-200 bg-white shrink-0">
              <Link
                href="/patient/dashboard"
                onClick={() => setIsSidebarOpen(false)}
                className="inline-flex items-center min-h-11 px-1 rounded-md focus-visible:outline-2 focus-visible:outline-primary-600"
              >
                <Image
                  src={logoImg}
                  alt="MediRoute India"
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
                className="inline-flex lg:hidden items-center justify-center w-11 h-11 -mr-1.5 rounded-md text-surface-500 hover:text-surface-900 hover:bg-surface-100 transition-colors"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            {/* Navigation Links */}
            <nav aria-label="Care sections" className="p-3 space-y-5 overflow-y-auto flex-1">
              {NAV_SECTIONS.map((section) => (
                <div key={section.title} className="space-y-1">
                  <p className="px-2.5 text-[11px] font-medium text-surface-400 uppercase tracking-wide mb-1.5">
                    {section.title}
                  </p>
                  <div className="space-y-0.5">
                    {section.items.map((item) => {
                      const isActive = pathname === item.href;
                      const ItemIcon = item.Icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={isActive ? 'page' : undefined}
                          onClick={() => setIsSidebarOpen(false)}
                          className={`
                            flex items-center gap-2.5 px-2.5 min-h-11 text-xs font-medium rounded-md
                            transition-colors duration-150
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
              ))}
            </nav>
          </div>

          {/* Account Summary & Sign Out */}
          <div className="border-t border-surface-200 p-3 bg-surface-50/60 space-y-1.5 shrink-0">
            <Link
              href="/patient/profile"
              onClick={() => setIsSidebarOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 min-h-11 bg-white border border-surface-200 hover:border-surface-300 rounded-md transition-colors"
            >
              {isUserLoading ? (
                <>
                  <div className="w-8 h-8 rounded-full bg-surface-200 animate-pulse shrink-0" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="h-3 w-24 rounded bg-surface-200 animate-pulse" />
                    <div className="h-2.5 w-28 rounded bg-surface-100 animate-pulse" />
                  </div>
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-full bg-primary-50 text-primary-800 flex items-center justify-center font-semibold text-xs shrink-0 border border-primary-200">
                    {userInitial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-surface-900 truncate">
                      {userName || 'My Care Account'}
                    </p>
                    <p className="text-[11px] text-surface-500 truncate">
                      {userEmail || 'View profile'}
                    </p>
                  </div>
                </>
              )}
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-2.5 min-h-11 text-xs font-medium text-surface-600 hover:text-surface-900 hover:bg-surface-200/60 rounded-md transition-colors text-left"
            >
              <LogOut className="w-4 h-4 text-surface-400 shrink-0" aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        </aside>

        {/* Mobile Drawer Backdrop */}
        {isSidebarOpen && (
          <div
            aria-hidden="true"
            className="fixed inset-0 z-30 bg-surface-900/30 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* ─── Main Viewport Area ────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* 56px Top Bar — Hairline aligned with sidebar header & content grid */}
          <header className="sticky top-0 z-20 min-h-14 bg-white border-b border-surface-200 flex items-center px-4 sm:px-6 lg:px-8 shrink-0">
            <div className="max-w-6xl mx-auto w-full flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  className="inline-flex lg:hidden items-center justify-center w-11 h-11 -ml-2 rounded-md text-surface-600 hover:text-surface-900 hover:bg-surface-100 transition-colors shrink-0"
                  onClick={() => setIsSidebarOpen(true)}
                  aria-label="Open navigation menu"
                  aria-expanded={isSidebarOpen}
                >
                  <Menu className="w-5 h-5" aria-hidden="true" />
                </button>

                <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs min-w-0">
                  <Link
                    href="/patient/dashboard"
                    className="hidden sm:inline-flex items-center min-h-11 px-1.5 rounded-md font-normal text-surface-500 hover:text-surface-900 transition-colors shrink-0"
                  >
                    Care Portal
                  </Link>
                  <ChevronRight
                    className="hidden sm:block w-3.5 h-3.5 text-surface-400 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="font-medium text-surface-900 truncate">
                    <span className="sm:hidden">{activeNavItem.shortLabel}</span>
                    <span className="hidden sm:inline">{activeNavItem.label}</span>
                  </span>
                </nav>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <CurrencySelector variant="compact" />
                <NotificationBell />

                <Link
                  href="/patient/appointments"
                  className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3 sm:px-3.5 rounded-md bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium border border-primary-700/20 shadow-2xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span className="sm:hidden">Book</span>
                  <span className="hidden sm:inline">Book Consultation</span>
                </Link>
              </div>
            </div>
          </header>

          <GlobalAlertBanner text={alertBannerText} />

          {/* Strictly Aligned Main Content Container */}
          <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 min-w-0">
            <div className="max-w-6xl mx-auto w-full">
              {children}
            </div>
          </main>
        </div>
      </div>
    </PatientSessionContext.Provider>
  );
}
