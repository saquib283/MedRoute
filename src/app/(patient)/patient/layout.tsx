'use client';

/**
 * Afzal Healthcare — Patient Sidebar & Layout Container
 * Restrained clinical light-mode layout.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import logoImg from '../../../../public/assets/logo.png';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import {
  LayoutDashboard,
  User,
  Calendar,
  FolderLock,
  MessageSquare,
  Receipt,
  Building2,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userName, setUserName] = useState('Patient');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    // Fetch profile details to populate layout header
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/v1/auth/me');
        const data = await res.json();
        if (data.success && data.data?.user) {
          setUserName(data.data.user.fullName);
          setUserEmail(data.data.user.email);
        }
      } catch (err) {
        console.error('Failed to load profile in layout', err);
      }
    };
    fetchProfile();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error', err);
    } finally {
      router.push('/login');
    }
  };


  interface NavSection {
    title: string;
    items: NavItem[];
  }

  const navSections: NavSection[] = [
    {
      title: 'Care Workspace',
      items: [
        {
          label: 'Overview',
          href: '/patient/dashboard',
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          ),
        },
        {
          label: 'Billing & Receipts',
          href: '/patient/billing',
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
        },
        {
          label: 'Accommodations & Hotels',
          href: '/patient/accommodations',
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0v-5a2 2 0 012-2h2a2 2 0 012 2v5m-4 0h4" />
            </svg>
          ),
        },
        {
          label: 'Appointments',
          href: '/patient/appointments',
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          ),
        },
      ],
    },
    {
      title: 'Resources & Records',
      items: [
        {
          label: 'Medical Profile',
          href: '/patient/profile',
          icon: <User className="w-5 h-5" />,
        },
        {
          label: 'Document Vault',
          href: '/patient/documents',
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-2m-4-1v8m0 0l3-3m-3 3L9 8m-5 5h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293h3.172a1 1 0 00.707-.293l2.414-2.414a1 1 0 01.707-.293H20" />
            </svg>
          ),
        },
        {
          label: 'Secure Messages',
          href: '/patient/messages',
          icon: (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          ),
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen flex bg-surface-100 font-sans">
      {/* ─── Sidebar Navigation ────────────────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-surface-200
          flex flex-col justify-between transition-transform duration-200 lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:shrink-0 shadow-xs
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div>
          {/* Logo Brand Header */}
          <div className="flex items-center px-6 h-16 border-b border-surface-150 bg-white">
            <Image src={logoImg} alt="Afzal Logo" width={120} height={38} className="h-9 w-auto object-contain shrink-0" priority />
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-6 overflow-y-auto">
            {navSections.map((section) => (
              <div key={section.title} className="space-y-2">
                <span className="px-3 text-[11px] font-black text-surface-400 uppercase tracking-widest block mb-2">
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
                          flex items-center gap-3 px-3 py-2.5 text-xs font-bold rounded-xl transition-all duration-150
                          ${
                            isActive
                              ? 'bg-primary-50 text-primary-800 shadow-xs'
                              : 'text-surface-700 hover:bg-surface-100 hover:text-surface-900'
                          }
                        `}
                        onClick={() => setIsSidebarOpen(false)}
                      >
                        <span className={isActive ? 'text-primary-600' : 'text-surface-400 group-hover:text-surface-600'}>
                          {item.icon}
                        </span>
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* User profile dropdown and Logout */}
        <div className="border-t border-surface-200 p-4 bg-surface-50/60 space-y-3 shrink-0">
          <Link
            href="/patient/profile"
            onClick={() => setIsSidebarOpen(false)}
            className="flex items-center gap-3 p-2 bg-white border border-surface-200 hover:border-primary-300 rounded-xl shadow-2xs transition-colors"
          >
            <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-800 flex items-center justify-center font-black text-xs shrink-0 border border-primary-200">
              {userName.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold text-surface-900 truncate">{userName}</p>
              <p className="text-xs text-surface-500 truncate font-medium">{userEmail}</p>
            </div>
          </Link>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-surface-600 hover:text-surface-900 hover:bg-surface-100 rounded-xl transition-colors text-left"
          >
            <svg className="w-4 h-4 text-surface-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sign Out</span>
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
        <header className="h-16 bg-white border-b border-surface-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 z-10 shrink-0">
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
            {pathname === '/patient/dashboard' && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center font-bold">
                  <LayoutDashboard className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-primary-700 uppercase tracking-wider block mb-0.5">Patient Portal</span>
                  <h2 className="text-base font-bold text-surface-900 tracking-tight">Overview Dashboard</h2>
                </div>
              </div>
            )}

            {pathname === '/patient/profile' && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center font-bold">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-primary-700 uppercase tracking-wider block mb-0.5">Clinical File</span>
                  <h2 className="text-base font-bold text-surface-900 tracking-tight">Medical Profile</h2>
                </div>
              </div>
            )}

            {pathname === '/patient/appointments' && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-primary-700 uppercase tracking-wider block mb-0.5">Clinical Schedule</span>
                  <h2 className="text-base font-bold text-surface-900 tracking-tight">Consultations & Care Appointments</h2>
                </div>
              </div>
            )}

            {pathname === '/patient/documents' && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center font-bold">
                  <FolderLock className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-primary-700 uppercase tracking-wider block mb-0.5">ePHI Security</span>
                  <h2 className="text-base font-bold text-surface-900 tracking-tight">Encrypted Document Vault</h2>
                </div>
              </div>
            )}

            {pathname === '/patient/messages' && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center font-bold">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-primary-700 uppercase tracking-wider block mb-0.5">Real-Time Messaging</span>
                  <h2 className="text-base font-bold text-surface-900 tracking-tight">Coordination Chat</h2>
                </div>
              </div>
            )}

            {pathname === '/patient/billing' && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center font-bold">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-primary-700 uppercase tracking-wider block mb-0.5">Financial Ledger</span>
                  <h2 className="text-base font-bold text-surface-900 tracking-tight">Billing &amp; Receipts</h2>
                </div>
              </div>
            )}

            {pathname === '/patient/accommodations' && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center font-bold">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-xs font-bold text-primary-700 uppercase tracking-wider block mb-0.5">Partner Lodging</span>
                  <h2 className="text-base font-bold text-surface-900 tracking-tight">Accommodations &amp; Hotels</h2>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            {/* Quick action button for dashboard */}
            <Link href="/patient/appointments">
              <Button size="sm">
                Request Appointment
              </Button>
            </Link>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
