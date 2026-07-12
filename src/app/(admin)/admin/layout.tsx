'use client';

/**
 * MediRoute India — Admin Portal Layout
 * Full-featured sidebar with sections for Operations, People, Partners, System.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import logoImg from '../../../../public/assets/logo.png';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadUserData() {
      try {
        const res = await fetch('/api/v1/auth/me');
        if (res.ok) {
          const data = await res.json();
          const role = data.data?.user?.role;
          if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
            router.push('/login');
            return;
          }
          setUserName(data.data?.user?.fullName || 'Admin');
          setUserEmail(data.data?.user?.email);
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

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const menuSections = [
    {
      label: 'Operations',
      items: [
        { href: '/admin/dashboard', icon: DashboardIcon, label: 'Dashboard' },
        { href: '/admin/cases', icon: CasesIcon, label: 'All Cases' },
        { href: '/admin/appointments', icon: CalendarIcon, label: 'All Appointments' },
      ],
    },
    {
      label: 'People',
      items: [
        { href: '/admin/users', icon: UsersIcon, label: 'User Management' },
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
      ],
    },
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
        <div className="p-6 pb-2 hidden lg:flex items-center gap-3 border-b border-surface-100/50 pb-5">
          <Image src={logoImg} alt="Afzal Logo" width={64} height={32} className="object-contain" priority />
          <div className="h-5 w-px bg-surface-200" />
          <span className="font-bold text-surface-900 tracking-tight text-sm">MediRoute India</span>
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
                        {item.label}
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
function UsersIcon(p: React.SVGProps<SVGSVGElement>) { return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>; }
function HospitalIcon(p: React.SVGProps<SVGSVGElement>) { return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>; }
function DoctorIcon(p: React.SVGProps<SVGSVGElement>) { return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>; }
function HostelIcon(p: React.SVGProps<SVGSVGElement>) { return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" /></svg>; }
function SpecIcon(p: React.SVGProps<SVGSVGElement>) { return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>; }
function AuditIcon(p: React.SVGProps<SVGSVGElement>) { return <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} {...p}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>; }
