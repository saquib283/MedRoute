'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  Calendar,
  ClipboardList,
  Coins,
  HeartPulse,
  Home,
  Inbox,
  LayoutDashboard,
  LayoutTemplate,
  Mail,
  Receipt,
  Settings,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  User,
  Users,
} from 'lucide-react';
import { PortalShell } from '@/components/PortalShell';

const ROUTE_TITLES: Record<string, string> = {
  '/admin/dashboard': 'Operations Dashboard',
  '/admin/billing': 'Billing & Commissions',
  '/admin/revenue': 'Revenue Analytics',
  '/admin/cases': 'All Cases',
  '/admin/appointments': 'All Appointments',
  '/admin/escalations': 'Escalations',
  '/admin/leads': 'Lead Queries',
  '/admin/users': 'User Management',
  '/admin/patients': 'Patients',
  '/admin/hospitals': 'Hospitals',
  '/admin/doctors': 'Doctors',
  '/admin/hostels': 'Accommodations',
  '/admin/specialisations': 'Specialisations',
  '/admin/audit-logs': 'Audit Logs',
  '/admin/notifications': 'Notifications',
  '/admin/analytics': 'Advanced Analytics',
  '/admin/compliance': 'Compliance & Consents',
  '/admin/settings/currency': 'Exchange Rates & Currencies',
  '/admin/email-campaigns': 'Email Campaigns',
  '/admin/email-templates': 'Email Templates',
  '/admin/settings': 'System Settings',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
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
          if (role !== 'ADMIN') {
            router.push('/login');
            return;
          }
          setUserName(data.data?.user?.fullName || 'Admin');
          setUserEmail(data.data?.user?.email || '');
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

  const isAdmin = userRole === 'ADMIN';

  const sections = [
    {
      label: 'Operations',
      items: [
        { href: '/admin/dashboard', icon: <LayoutDashboard className="w-4 h-4" />, label: 'Dashboard' },
        { href: '/admin/billing', icon: <Receipt className="w-4 h-4" />, label: 'Billing & Commissions' },
        { href: '/admin/revenue', icon: <TrendingUp className="w-4 h-4" />, label: 'Revenue Analytics' },
        { href: '/admin/cases', icon: <Briefcase className="w-4 h-4" />, label: 'All Cases' },
        { href: '/admin/appointments', icon: <Calendar className="w-4 h-4" />, label: 'All Appointments' },
        {
          href: '/admin/escalations',
          icon: <AlertTriangle className="w-4 h-4" />,
          label: 'Escalations',
          badge: escalationCount > 0 ? escalationCount : undefined,
        },
      ],
    },
    {
      label: 'People',
      items: [
        { href: '/admin/leads', icon: <Inbox className="w-4 h-4" />, label: 'Lead Queries' },
        { href: '/admin/users', icon: <Users className="w-4 h-4" />, label: 'User Management' },
        { href: '/admin/patients', icon: <User className="w-4 h-4" />, label: 'Patients' },
      ],
    },
    {
      label: 'Partners',
      items: [
        { href: '/admin/hospitals', icon: <Building2 className="w-4 h-4" />, label: 'Hospitals' },
        { href: '/admin/doctors', icon: <HeartPulse className="w-4 h-4" />, label: 'Doctors' },
        { href: '/admin/hostels', icon: <Home className="w-4 h-4" />, label: 'Accommodations' },
        { href: '/admin/specialisations', icon: <Stethoscope className="w-4 h-4" />, label: 'Specialisations' },
      ],
    },
    {
      label: 'System',
      items: [
        { href: '/admin/audit-logs', icon: <ClipboardList className="w-4 h-4" />, label: 'Audit Logs' },
        { href: '/admin/notifications', icon: <Bell className="w-4 h-4" />, label: 'Notifications' },
      ],
    },
    ...(isAdmin
      ? [
          {
            label: 'Governance & Config',
            items: [
              { href: '/admin/analytics', icon: <BarChart3 className="w-4 h-4" />, label: 'Advanced Analytics' },
              { href: '/admin/compliance', icon: <ShieldCheck className="w-4 h-4" />, label: 'Compliance' },
              { href: '/admin/settings/currency', icon: <Coins className="w-4 h-4" />, label: 'Currencies' },
              { href: '/admin/email-campaigns', icon: <Mail className="w-4 h-4" />, label: 'Email Campaigns' },
              { href: '/admin/email-templates', icon: <LayoutTemplate className="w-4 h-4" />, label: 'Email Templates' },
              { href: '/admin/settings', icon: <Settings className="w-4 h-4" />, label: 'Settings' },
            ],
          },
        ]
      : []),
  ];

  const routeTitle =
    Object.entries(ROUTE_TITLES)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([prefix]) => pathname.startsWith(prefix))?.[1] || 'Administration';

  return (
    <PortalShell
      portalName="Admin"
      homeHref="/admin/dashboard"
      sections={sections}
      user={{ fullName: userName, email: userEmail, roleLabel: 'Administrator' }}
      pageTitle={routeTitle}
      showCurrencySelector
      alertBanner={
        alertBannerText ? (
          <div className="bg-warning-50 text-warning-900 border-b border-warning-200 px-4 py-2 text-center text-xs font-semibold flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning-700 shrink-0" />
            <span>{alertBannerText}</span>
          </div>
        ) : undefined
      }
      onSignOut={handleLogout}
    >
      {children}
    </PortalShell>
  );
}

