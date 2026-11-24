'use client';

/**
 * Afzal Healthcare — Admin Portal Shell
 * Unified 240px sidebar, 56px hairline-aligned header bar, and max-w-6xl content alignment.
 */

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import logoImg from '../../../../public/assets/logo.png';
import { usePathname, useRouter } from 'next/navigation';
import { GlobalAlertBanner } from '@/components/ui/GlobalAlertBanner';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import {
  LayoutDashboard,
  Briefcase,
  Calendar,
  AlertTriangle,
  Users,
  UserCheck,
  Building2,
  Hotel,
  Stethoscope,
  Award,
  FileText,
  Bell,
  BarChart3,
  Mail,
  FileCode,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronRight,
} from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userRole, setUserRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [escalationCount, setEscalationCount] = useState(0);
  const [alertBannerText, setAlertBannerText] = useState('');

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
          const role = data.data?.user?.role;
          if (role !== 'ADMIN') {
            if (!cancelled) router.push('/login');
            return;
          }
          if (!cancelled) {
            setUserName(data.data?.user?.fullName || 'Administrator');
            setUserEmail(data.data?.user?.email || '');
            setUserRole(role);
            setAlertBannerText(data.data?.alertBannerText || '');
          }
        } else {
          if (!cancelled) router.push('/login');
        }
      } catch (err) {
        console.error('Failed to load admin info:', err);
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

  useEffect(() => {
    if (!userRole) return;
    fetch('/api/v1/admin/escalations?limit=1')
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setEscalationCount(d.data.pagination.total);
      })
      .catch(() => {});
  }, [userRole]);

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      router.push('/login');
    }
  };

  const isAdmin = userRole === 'ADMIN';

  const menuSections = useMemo(
    () => [
      {
        label: 'Operations',
        items: [
          { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
          { href: '/admin/cases', icon: Briefcase, label: 'All Cases' },
          { href: '/admin/appointments', icon: Calendar, label: 'All Appointments' },
          {
            href: '/admin/escalations',
            icon: AlertTriangle,
            label: 'Escalations',
            badge: escalationCount > 0 ? escalationCount : undefined,
          },
        ],
      },
      {
        label: 'People',
        items: [
          { href: '/admin/users', icon: Users, label: 'Users' },
          { href: '/admin/patients', icon: UserCheck, label: 'Patients' },
        ],
      },
      {
        label: 'Partners',
        items: [
          { href: '/admin/hospitals', icon: Building2, label: 'Hospitals' },
          { href: '/admin/accommodations', icon: Hotel, label: 'Accommodations' },
          { href: '/admin/doctors', icon: Stethoscope, label: 'Doctors' },
          { href: '/admin/specialisations', icon: Award, label: 'Specialisations' },
        ],
      },
      {
        label: 'Governance',
        items: [
          { href: '/admin/audit-logs', icon: FileText, label: 'Audit Logs' },
          { href: '/admin/notifications', icon: Bell, label: 'Notifications' },
        ],
      },
      ...(isAdmin
        ? [
            {
              label: 'Administration',
              items: [
                { href: '/admin/analytics', icon: BarChart3, label: 'Analytics & Revenue' },
                { href: '/admin/email-campaigns', icon: Mail, label: 'Email Campaigns' },
                { href: '/admin/email-templates', icon: FileCode, label: 'Email Templates' },
                { href: '/admin/settings', icon: Settings, label: 'System Settings' },
              ],
            },
          ]
        : []),
    ],
    [escalationCount, isAdmin]
  );

  const activeLabel = useMemo(() => {
    if (pathname.startsWith('/admin/cases/') && pathname.endsWith('/pathway')) {
      return 'Clinical Pathway';
    }
    const all = menuSections.flatMap((s) => s.items);
    return all.find((item) => item.href === pathname)?.label || 'Administration';
  }, [menuSections, pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-100">
        <div className="flex items-center gap-2.5 text-xs text-surface-600">
          <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <span>Verifying administrator session…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-100 flex font-sans">
      {/* ─── Sidebar Navigation (240px) ────────────────────────────────── */}
      <aside
        aria-label="Admin navigation"
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
              href="/admin/dashboard"
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

          <nav className="flex-1 p-3 overflow-y-auto space-y-5">
            {menuSections.map((section) => (
              <div key={section.label} className="space-y-1">
                <p className="px-2.5 text-[11px] font-medium text-surface-400 uppercase tracking-wide mb-1.5">
                  {section.label}
                </p>
                <ul className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));
                    const Icon = item.icon;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={isActive ? 'page' : undefined}
                          onClick={() => setIsSidebarOpen(false)}
                          className={`flex items-center gap-2.5 px-2.5 min-h-10 rounded-md text-xs font-medium transition-colors duration-150 ${
                            isActive
                              ? 'bg-primary-50/90 text-primary-900 border border-primary-200/80'
                              : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900 border border-transparent'
                          }`}
                        >
                          <Icon
                            className={`w-4 h-4 shrink-0 ${
                              isActive ? 'text-primary-700' : 'text-surface-400'
                            }`}
                            aria-hidden="true"
                          />
                          <span className="flex-1 truncate">{item.label}</span>
                          {'badge' in item && item.badge && (
                            <span className="px-1.5 py-0.5 rounded bg-danger-50 text-danger-700 border border-danger-200 text-[11px] font-medium tabular-nums">
                              {item.badge}
                            </span>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="p-3 border-t border-surface-200 bg-surface-50/60 space-y-1.5 shrink-0">
          <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-md bg-white border border-surface-200">
            <div className="w-8 h-8 rounded-full bg-primary-50 border border-primary-200 flex items-center justify-center text-primary-800 font-semibold text-xs shrink-0">
              {userName.charAt(0) || 'A'}
            </div>
            <div className="flex-1 min-w-0">
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
            onClick={handleLogout}
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
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 min-h-14 bg-white border-b border-surface-200 flex items-center px-4 sm:px-6 lg:px-8 shrink-0">
          <div className="max-w-6xl mx-auto w-full flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="inline-flex lg:hidden items-center justify-center w-11 h-11 -ml-2 text-surface-600 hover:text-surface-900 hover:bg-surface-100 rounded-md"
                aria-label="Toggle navigation menu"
              >
                <Menu className="w-5 h-5" aria-hidden="true" />
              </button>

              <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs min-w-0">
                <Link
                  href="/admin/dashboard"
                  className="hidden sm:inline-flex items-center min-h-11 px-1.5 rounded-md text-surface-500 hover:text-surface-900 transition-colors shrink-0"
                >
                  Admin Console
                </Link>
                <ChevronRight
                  className="hidden sm:block w-3.5 h-3.5 text-surface-400 shrink-0"
                  aria-hidden="true"
                />
                <span className="font-medium text-surface-900 truncate">{activeLabel}</span>
              </nav>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-md bg-surface-100 text-surface-700 border border-surface-200 text-xs font-medium">
                Administrator
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
