'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Calendar, Users } from 'lucide-react';
import { PortalShell } from '@/components/PortalShell';

const ROUTE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/doctor/dashboard': { title: 'Clinical Overview', subtitle: 'Daily schedule and assessments' },
  '/doctor/appointments': { title: 'Consultations', subtitle: 'Appointments and clinical notes' },
  '/doctor/patients': { title: 'Patient Directory', subtitle: 'Assigned patient medical dossiers' },
};

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
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
          if (role !== 'DOCTOR' && role !== 'ADMIN') {
            router.push('/login');
            return;
          }
          setUserName(data.data?.user?.fullName || 'Physician');
          setUserEmail(data.data?.user?.email || '');
        } else {
          router.push('/login');
        }
      } catch (err) {
        console.error('Failed to load doctor info:', err);
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
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-100">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sections = [
    {
      label: 'Clinical Workspace',
      items: [
        { href: '/doctor/dashboard', icon: <LayoutDashboard className="w-4 h-4" />, label: 'Overview' },
        { href: '/doctor/appointments', icon: <Calendar className="w-4 h-4" />, label: 'Consultations' },
        { href: '/doctor/patients', icon: <Users className="w-4 h-4" />, label: 'Patient Directory' },
      ],
    },
  ];

  const routeMeta = Object.entries(ROUTE_TITLES).find(([prefix]) =>
    pathname.startsWith(prefix)
  )?.[1];

  return (
    <PortalShell
      portalName="Physician"
      homeHref="/doctor/dashboard"
      sections={sections}
      user={{ fullName: userName, email: userEmail, roleLabel: 'Attending Physician' }}
      pageTitle={routeMeta?.title || 'Physician Portal'}
      pageSubtitle={routeMeta?.subtitle}
      onSignOut={handleLogout}
    >
      {children}
    </PortalShell>
  );
}
