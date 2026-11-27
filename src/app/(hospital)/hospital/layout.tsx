'use client';

/**
 * MediRoute India — Hospital International Patient Services (IPS) Layout Container
 * Dedicated partner portal for accredited hospitals (Fortis, Medanta, Apollo, Max).
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import logoImg from '../../../../public/assets/logo.png';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { CurrencySelector } from '@/components/ui/CurrencySelector';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Send,
  Building2,
  Users,
  Receipt,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Stethoscope,
  Plane,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

export default function HospitalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [hospitalName, setHospitalName] = useState('Partner Hospital IPS');
  const [accreditation, setAccreditation] = useState('JCI & NABH Accredited');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/v1/auth/me');
        const data = await res.json();
        if (data.success && data.data?.user) {
          setUserEmail(data.data.user.email);
        }

        const dashRes = await fetch('/api/v1/hospital/dashboard');
        const dashData = await dashRes.json();
        if (dashData.success && dashData.data?.hospital) {
          setHospitalName(dashData.data.hospital.name);
          if (dashData.data.hospital.accreditation) {
            setAccreditation(dashData.data.hospital.accreditation);
          }
        }
      } catch (err) {
        console.error('Failed to load hospital profile in layout', err);
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

  const navItems: NavItem[] = [
    {
      label: 'IPS Dashboard',
      href: '/hospital/dashboard',
      icon: <LayoutDashboard className="w-5 h-5" />,
    },
    {
      label: 'Referrals & Opinions',
      href: '/hospital/cases',
      icon: <FileSpreadsheet className="w-5 h-5" />,
    },
    {
      label: 'Visa Letters (VIL)',
      href: '/hospital/visa',
      icon: <Plane className="w-5 h-5" />,
    },
    {
      label: 'Doctor Specialists',
      href: '/hospital/doctors',
      icon: <Stethoscope className="w-5 h-5" />,
    },
    {
      label: 'B2B Billing & Commission',
      href: '/hospital/finance',
      icon: <Receipt className="w-5 h-5" />,
    },
  ];

  return (
    <div className="min-h-screen flex bg-surface-100 font-sans">
      {/* ─── Sidebar Navigation ────────────────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-surface-200/80
          flex flex-col justify-between transition-transform duration-200 lg:translate-x-0 lg:sticky lg:top-0 lg:h-screen lg:shrink-0
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div>
          {/* Logo Brand Header */}
          <div className="flex items-center justify-between px-6 h-16 border-b border-surface-200/60 bg-white">
            <Image src={logoImg} alt="MediRoute Logo" width={110} height={36} className="h-9 w-auto object-contain shrink-0" priority />
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-primary-900 text-white tracking-widest">
              IPS
            </span>
          </div>

          {/* Hospital Partner Badge */}
          <div className="p-4 mx-3 my-3 bg-surface-50 border border-surface-200 rounded-xl space-y-1">
            <div className="flex items-center gap-1.5 text-primary-700 text-xs font-bold truncate">
              <Building2 className="w-4 h-4 shrink-0 text-primary-600" />
              <span className="truncate">{hospitalName}</span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-surface-500">
              <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
              <span className="truncate">{accreditation}</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            <span className="px-3 text-[10px] font-bold text-surface-400 uppercase tracking-widest block mb-2">
              International Patient Desk
            </span>
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 text-xs font-bold rounded-lg transition-colors duration-150
                    ${
                      isActive
                        ? 'bg-primary-900 text-white shadow-xs'
                        : 'text-surface-600 hover:text-surface-900 hover:bg-surface-100'
                    }
                  `}
                >
                  <span className={isActive ? 'text-white' : 'text-surface-400'}>{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-surface-200/80 bg-surface-50/50 space-y-3">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-800 font-bold flex items-center justify-center text-xs shrink-0">
              IPS
            </div>
            <div className="truncate">
              <span className="block font-bold text-surface-800 truncate text-[11px]">{userEmail || 'Coordinator'}</span>
              <span className="block text-[10px] text-surface-400 uppercase font-semibold">Hospital Partner</span>
            </div>
          </div>

          <Button variant="ghost" size="sm" fullWidth onClick={handleLogout} className="!text-xs text-danger-600 hover:text-danger-700 hover:bg-danger-50">
            <LogOut className="w-3.5 h-3.5 mr-1.5" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* ─── Main Content Canvas ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-surface-200/80 sticky top-0 z-30 px-4 sm:px-8 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="lg:hidden p-2 rounded-lg text-surface-600 hover:bg-surface-100"
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-surface-900">{hospitalName}</h1>
              <p className="text-[11px] text-surface-500">International Patient Services (IPS) Desk</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <CurrencySelector />
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>B2B Network Active</span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
