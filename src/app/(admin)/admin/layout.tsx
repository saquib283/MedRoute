'use client';

/**
 * Afzal Healthcare — Admin Portal Layout
 * Full-featured sidebar with sections for Operations, People, Partners, System.
 * Admin-exclusive items conditionally rendered.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import logoImg from '../../../../public/assets/logo.png';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
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
    async function loadUserData() {
      try {
        const res = await fetch('/api/v1/auth/me');
        if (res.ok) {
          const data = await res.json();
          const role = data.data?.user?.role;
          if (role !== 'ADMIN' && role !== 'ADMIN') {
            router.push('/login');
            return;
          }
          setUserName(data.data?.user?.fullName || 'Admin');
          setUserEmail(data.data?.user?.email);
          setUserRole(role);
          setAlertBannerText(data.data?.alertBannerText || '');
        } else {
          router.push('/login');
        }
      } catch (err) {
        console.error('Failed to load admin info:', err);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }
    loadUserData();
  }, [router]);

  // Fetch escalation count for badge
  useEffect(() => {
    if (!userRole) return;
    fetch('/api/v1/admin/escalations?limit=1')
      .then(r => r.json())
      .then(d => { if (d.success) setEscalationCount(d.data.pagination.total); })
      .catch(() => {});
  }, [userRole]);

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };


  const isAdmin = userRole === 'ADMIN';

  const menuSections = [
    {
      label: 'Operations',
      items: [
        { href: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { href: '/admin/cases', icon: Briefcase, label: 'All Cases' },
        { href: '/admin/appointments', icon: Calendar, label: 'All Appointments' },
        { href: '/admin/escalations', icon: AlertTriangle, label: 'Escalations', badge: escalationCount > 0 ? escalationCount : undefined },
      ],
    },
    {
      label: 'People',
      items: [
        { href: '/admin/users', icon: Users, label: 'User Management' },
        { href: '/admin/patients', icon: UserCheck, label: 'Patients' },
      ],
    },
    {
      label: 'Partners',
      items: [
        { href: '/admin/hospitals', icon: Building2, label: 'Hospitals' },
        { href: '/admin/accommodations', icon: Hotel, label: 'Hotel Accommodations' },
        { href: '/admin/doctors', icon: Stethoscope, label: 'Doctors' },
        { href: '/admin/specialisations', icon: Award, label: 'Specialisations' },
      ],
    },
    {
      label: 'System',
      items: [
        { href: '/admin/audit-logs', icon: FileText, label: 'Audit Logs' },
        { href: '/admin/notifications', icon: Bell, label: 'Notifications' },
      ],
    },
    ...(isAdmin
      ? [
          {
            label: 'Admin',
            items: [
              { href: '/admin/analytics', icon: BarChart3, label: 'Advanced Analytics' },
              { href: '/admin/email-campaigns', icon: Mail, label: 'Email Campaigns' },
              { href: '/admin/email-templates', icon: FileCode, label: 'Email Templates' },
              { href: '/admin/settings', icon: Settings, label: 'Settings' },
            ],
          },
        ]
      : []),
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-surface-200">
        <Image src={logoImg} alt="Afzal Logo" width={96} height={48} className="object-contain" priority />
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 -mr-2 text-surface-500 hover:text-surface-700 hover:bg-surface-100 rounded-lg"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[280px] bg-white border-r border-surface-200 transform transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:shrink-0 flex flex-col ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="p-6 hidden lg:flex items-center border-b border-surface-100/50 pb-5">
          <Image src={logoImg} alt="Afzal Logo" width={110} height={36} className="h-9 w-auto object-contain" priority />
        </div>


        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 overflow-y-auto space-y-7">
          {menuSections.map((section) => (
            <div key={section.label}>
              <h3 className="px-3 text-[11px] font-bold uppercase tracking-wider text-surface-400 mb-2.5">
                {section.label}
              </h3>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setIsSidebarOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                          isActive
                            ? 'bg-primary-50 text-primary-700 relative before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:bg-primary-600 before:rounded-r'
                            : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${isActive ? 'text-primary-600' : 'text-surface-400'}`} />
                        <span className="flex-1">{item.label}</span>
                        {'badge' in item && item.badge && (
                          <span className="px-2 py-0.5 rounded-full bg-danger-500 text-white text-[10px] font-bold">
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

        {/* User Card */}
        <div className="p-4 border-t border-surface-200">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-50 border border-surface-200/50">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm shrink-0">
              {userName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-sm font-bold text-surface-900 truncate" title={userName}>{userName}</p>
              <p className="text-[11px] text-surface-500 truncate" title={userEmail}>{userEmail}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full mt-3 justify-center text-danger-600 hover:bg-danger-50 hover:text-danger-700 font-bold text-sm" onClick={handleLogout}>
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 flex flex-col min-h-screen">
        {alertBannerText && (
          <div className="bg-warning-500 text-white px-4 py-2.5 text-center text-xs font-bold flex items-center justify-center gap-2 shadow-sm shrink-0 border-b border-warning-600 animate-slide-down">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{alertBannerText}</span>
          </div>
        )}
        <div className="flex-1 p-4 lg:p-8 overflow-y-auto">
          {children}
        </div>
      </main>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-surface-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
    </div>
  );
}

