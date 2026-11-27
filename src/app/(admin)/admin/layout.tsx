'use client';

/**
 * MediRoute India — Admin Portal Layout
 * Full-featured sidebar with sections for Operations, People, Partners, System.
 * Admin-exclusive items conditionally rendered.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import logoImg from '../../../../public/assets/logo.png';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { CurrencySelector } from '@/components/ui/CurrencySelector';

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
        { href: '/admin/dashboard', icon: DashboardIcon, label: 'Dashboard' },
        { href: '/admin/billing', icon: AnalyticsIcon, label: 'Billing & Commissions' },
        { href: '/admin/revenue', icon: AnalyticsIcon, label: 'Revenue Analytics' },
        { href: '/admin/cases', icon: CasesIcon, label: 'All Cases' },
        { href: '/admin/appointments', icon: CalendarIcon, label: 'All Appointments' },
        { href: '/admin/escalations', icon: EscalationIcon, label: 'Escalations', badge: escalationCount > 0 ? escalationCount : undefined },
      ],
    },
    {
      label: 'People',
      items: [
        { href: '/admin/leads', icon: LeadIcon, label: 'Lead Queries' },
        { href: '/admin/users', icon: UsersIcon, label: 'User Management' },
        { href: '/admin/patients', icon: PatientIcon, label: 'Patients' },
      ],
    },
    {
      label: 'Partners',
      items: [
        { href: '/admin/hospitals', icon: HospitalIcon, label: 'Hospitals' },
        { href: '/admin/doctors', icon: DoctorIcon, label: 'Doctors' },
        { href: '/admin/hostels', icon: HostelIcon, label: 'Hostels' },
        { href: '/admin/specialisations', icon: SpecIcon, label: 'Specialisations' },
      ],
    },
    {
      label: 'System',
      items: [
        { href: '/admin/audit-logs', icon: AuditIcon, label: 'Audit Logs' },
        { href: '/admin/notifications', icon: NotificationsIcon, label: 'Notifications' },
      ],
    },
    ...(isAdmin
      ? [
          {
            label: 'Admin',
            items: [
              { href: '/admin/analytics', icon: AnalyticsIcon, label: 'Advanced Analytics' },
              { href: '/admin/compliance', icon: AuditIcon, label: 'Legal & Compliance' },
              { href: '/admin/settings/currency', icon: AnalyticsIcon, label: 'Forex & Currencies' },
              { href: '/admin/email-campaigns', icon: CampaignIcon, label: 'Email Campaigns' },
              { href: '/admin/email-templates', icon: TemplateIcon, label: 'Email Templates' },
              { href: '/admin/settings', icon: SettingsIcon, label: 'Settings' },
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
        >
          <MenuIcon className="w-6 h-6" />
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
              <h3 className="px-3 text-[11px] font-bold uppercase tracking-wider text-surface-500 mb-2.5">
                {section.label}
              </h3>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <li key={item.label}>
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

        {/* Currency & User Card */}
        <div className="p-4 border-t border-surface-200 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-surface-400">Viewing Currency</span>
            <CurrencySelector variant="header" />
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-50 border border-surface-200/50">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-sm shrink-0">
              {userName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <p className="text-sm font-bold text-surface-900 truncate" title={userName}>{userName}</p>
              <p className="text-[11px] text-surface-600 truncate" title={userEmail}>{userEmail}</p>
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

// ─── Icons ────────────────────────────────────────────────────────────
function MenuIcon(p: React.SVGProps<SVGSVGElement>) { return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>; }
function DashboardIcon(p: React.SVGProps<SVGSVGElement>) { return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>; }
function CasesIcon(p: React.SVGProps<SVGSVGElement>) { return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>; }
function CalendarIcon(p: React.SVGProps<SVGSVGElement>) { return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>; }
function EscalationIcon(p: React.SVGProps<SVGSVGElement>) { return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>; }
function UsersIcon(p: React.SVGProps<SVGSVGElement>) { return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>; }
function PatientIcon(p: React.SVGProps<SVGSVGElement>) { return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>; }
function HospitalIcon(p: React.SVGProps<SVGSVGElement>) { return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>; }
function DoctorIcon(p: React.SVGProps<SVGSVGElement>) { return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>; }
function HostelIcon(p: React.SVGProps<SVGSVGElement>) { return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>; }
function SpecIcon(p: React.SVGProps<SVGSVGElement>) { return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>; }
function AuditIcon(p: React.SVGProps<SVGSVGElement>) { return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>; }
function SettingsIcon(p: React.SVGProps<SVGSVGElement>) { return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>; }
function NotificationsIcon(p: React.SVGProps<SVGSVGElement>) { return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>; }
function AnalyticsIcon(p: React.SVGProps<SVGSVGElement>) { return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>; }
function CampaignIcon(p: React.SVGProps<SVGSVGElement>) { return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>; }
function TemplateIcon(p: React.SVGProps<SVGSVGElement>) { return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>; }
function LeadIcon(p: React.SVGProps<SVGSVGElement>) { return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>; }

