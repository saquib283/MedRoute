'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Map,
  User,
  Calendar,
  FolderLock,
  MessageSquare,
  Home,
  Scale,
  ShieldCheck,
  Receipt,
} from 'lucide-react';
import { PortalShell } from '@/components/PortalShell';
import { Button } from '@/components/ui/Button';

const ROUTE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/patient/dashboard': { title: 'Overview', subtitle: 'Treatment progress and coordinator updates' },
  '/patient/journey': { title: 'Care Journey', subtitle: 'Quotes, treatment plan e-signatures, and logistics' },
  '/patient/profile': { title: 'Medical Profile', subtitle: 'Demographics, allergies, and medical history' },
  '/patient/appointments': { title: 'Appointments', subtitle: 'Consultations and clinical schedule' },
  '/patient/accommodations': { title: 'Accommodations', subtitle: 'Verified medical stay options near hospitals' },
  '/patient/documents': { title: 'Document Vault', subtitle: 'Encrypted medical and travel documents' },
  '/patient/messages': { title: 'Messages', subtitle: 'Direct communication with your care coordinator' },
  '/patient/billing': { title: 'Billing & Payments', subtitle: 'Milestone invoices and payment receipts' },
  '/patient/grievance': { title: 'Grievance Desk', subtitle: 'Submit and track service or billing concerns' },
  '/patient/privacy': { title: 'Privacy & Data Rights', subtitle: 'Consent records and DSAR data export' },
};

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [userName, setUserName] = useState('Patient');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
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

  const sections = [
    {
      label: 'Care Workspace',
      items: [
        { label: 'Overview', href: '/patient/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
        { label: 'My Journey', href: '/patient/journey', icon: <Map className="w-4 h-4" /> },
        { label: 'Medical Profile', href: '/patient/profile', icon: <User className="w-4 h-4" /> },
        { label: 'Appointments', href: '/patient/appointments', icon: <Calendar className="w-4 h-4" /> },
        { label: 'Accommodations', href: '/patient/accommodations', icon: <Home className="w-4 h-4" /> },
      ],
    },
    {
      label: 'Records & Support',
      items: [
        { label: 'Document Vault', href: '/patient/documents', icon: <FolderLock className="w-4 h-4" /> },
        { label: 'Messages', href: '/patient/messages', icon: <MessageSquare className="w-4 h-4" /> },
        { label: 'Billing & Invoices', href: '/patient/billing', icon: <Receipt className="w-4 h-4" /> },
        { label: 'Grievance Desk', href: '/patient/grievance', icon: <Scale className="w-4 h-4" /> },
        { label: 'Privacy & Data', href: '/patient/privacy', icon: <ShieldCheck className="w-4 h-4" /> },
      ],
    },
  ];

  const routeMeta = Object.entries(ROUTE_TITLES).find(([prefix]) =>
    pathname.startsWith(prefix)
  )?.[1];

  return (
    <PortalShell
      portalName="Patient"
      homeHref="/patient/dashboard"
      sections={sections}
      user={{ fullName: userName, email: userEmail, roleLabel: 'Patient Account' }}
      pageTitle={routeMeta?.title || 'Patient Portal'}
      pageSubtitle={routeMeta?.subtitle}
      showCurrencySelector
      headerActions={
        <Link href="/patient/appointments">
          <Button size="sm">Request Appointment</Button>
        </Link>
      }
      onSignOut={handleLogout}
    >
      {children}
    </PortalShell>
  );
}
