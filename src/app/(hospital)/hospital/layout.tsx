'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Receipt,
  ShieldCheck,
  Stethoscope,
  Plane,
} from 'lucide-react';
import { PortalShell } from '@/components/PortalShell';

const ROUTE_TITLES: Record<string, string> = {
  '/hospital/dashboard': 'IPS Overview',
  '/hospital/cases': 'Referrals & Opinions',
  '/hospital/visa': 'Visa Letters (VIL)',
  '/hospital/doctors': 'Specialist Roster',
  '/hospital/finance': 'Billing & Commission',
};

export default function HospitalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [hospitalName, setHospitalName] = useState('Partner Hospital IPS');
  const [accreditation, setAccreditation] = useState('');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/v1/auth/me');
        const data = await res.json();
        if (data.success && data.data?.user) {
          setUserEmail(data.data.user.email || '');
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

  const sections = [
    {
      label: 'International Patient Desk',
      items: [
        {
          label: 'Overview',
          href: '/hospital/dashboard',
          icon: <LayoutDashboard className="w-4 h-4" />,
        },
        {
          label: 'Referrals & Opinions',
          href: '/hospital/cases',
          icon: <FileSpreadsheet className="w-4 h-4" />,
        },
        {
          label: 'Visa Letters (VIL)',
          href: '/hospital/visa',
          icon: <Plane className="w-4 h-4" />,
        },
        {
          label: 'Specialist Roster',
          href: '/hospital/doctors',
          icon: <Stethoscope className="w-4 h-4" />,
        },
        {
          label: 'Billing & Commission',
          href: '/hospital/finance',
          icon: <Receipt className="w-4 h-4" />,
        },
      ],
    },
  ];

  const routeTitle =
    Object.entries(ROUTE_TITLES).find(([prefix]) => pathname.startsWith(prefix))?.[1] ||
    'Hospital IPS Desk';

  return (
    <PortalShell
      portalName="Hospital IPS"
      homeHref="/hospital/dashboard"
      sections={sections}
      user={{
        fullName: hospitalName,
        email: userEmail,
        roleLabel: userEmail || 'IPS Coordinator',
      }}
      pageTitle={`${hospitalName} · ${routeTitle}`}
      pageSubtitle={accreditation || 'International Patient Services'}
      showCurrencySelector
      headerActions={
        accreditation ? (
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-success-50 text-success-700 border border-success-200 text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>{accreditation}</span>
          </div>
        ) : undefined
      }
      onSignOut={handleLogout}
    >
      {children}
    </PortalShell>
  );
}
