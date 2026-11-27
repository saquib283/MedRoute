'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Home,
  Calendar,
  MessageSquare,
} from 'lucide-react';
import { PortalShell } from '@/components/PortalShell';
import { Button } from '@/components/ui/Button';

const ROUTE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/manager/dashboard': { title: 'Operations Overview', subtitle: 'Case cohort metrics and schedule summary' },
  '/manager/patients': { title: 'Patient Cohort', subtitle: 'Assigned patients and intake profiles' },
  '/manager/cases': { title: 'Case Pipeline', subtitle: 'Case statuses, treatment plans, visa, and billing' },
  '/manager/accommodations': { title: 'Accommodations', subtitle: 'Guest house stays and booking requests' },
  '/manager/appointments': { title: 'Appointments', subtitle: 'Hospital consultations and procedures' },
  '/manager/chat': { title: 'Messages', subtitle: 'Patient coordination messages' },
};

export default function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
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
          if (role !== 'MANAGER' && role !== 'ADMIN') {
            router.push('/login');
            return;
          }
          setUserName(data.data?.user?.fullName || 'Coordinator');
          setUserEmail(data.data?.user?.email || '');
        } else {
          router.push('/login');
        }
      } catch (err) {
        console.error('Failed to load manager info:', err);
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
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
      router.push('/login');
    }
  };

  const sections = [
    {
      label: 'Care Workspace',
      items: [
        { label: 'Overview', href: '/manager/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
        { label: 'Patient Cohort', href: '/manager/patients', icon: <Users className="w-4 h-4" /> },
        { label: 'Case Pipeline', href: '/manager/cases', icon: <Briefcase className="w-4 h-4" /> },
      ],
    },
    {
      label: 'Operations & Support',
      items: [
        { label: 'Accommodations', href: '/manager/accommodations', icon: <Home className="w-4 h-4" /> },
        { label: 'Appointments', href: '/manager/appointments', icon: <Calendar className="w-4 h-4" /> },
        { label: 'Messages', href: '/manager/chat', icon: <MessageSquare className="w-4 h-4" /> },
      ],
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium text-surface-600">Verifying session...</span>
        </div>
      </div>
    );
  }

  const routeMeta = Object.entries(ROUTE_TITLES).find(([prefix]) =>
    pathname.startsWith(prefix)
  )?.[1];

  return (
    <PortalShell
      portalName="Coordinator"
      homeHref="/manager/dashboard"
      sections={sections}
      user={{ fullName: userName, email: userEmail, roleLabel: 'Case Coordinator' }}
      pageTitle={routeMeta?.title || 'Coordinator Portal'}
      pageSubtitle={routeMeta?.subtitle}
      showCurrencySelector
      headerActions={
        <Link href="/manager/appointments">
          <Button size="sm">Book Appointment</Button>
        </Link>
      }
      onSignOut={handleLogout}
    >
      {children}
    </PortalShell>
  );
}
