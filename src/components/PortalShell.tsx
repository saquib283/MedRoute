'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { LogOut, Menu, X } from 'lucide-react';
import { CurrencySelector } from '@/components/ui/CurrencySelector';

export interface PortalNavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
}

export interface PortalNavSection {
  label?: string;
  items: PortalNavItem[];
}

export interface PortalUserSummary {
  fullName?: string;
  email?: string;
  roleLabel?: string;
}

interface PortalShellProps {
  portalName: string;
  homeHref: string;
  sections: PortalNavSection[];
  user: PortalUserSummary | null;
  pageTitle?: string;
  pageSubtitle?: string;
  showCurrencySelector?: boolean;
  alertBanner?: React.ReactNode;
  headerActions?: React.ReactNode;
  onSignOut: () => void;
  children: React.ReactNode;
}

export function PortalShell({
  portalName,
  homeHref,
  sections,
  user,
  pageTitle,
  pageSubtitle,
  showCurrencySelector = false,
  alertBanner,
  headerActions,
  onSignOut,
  children,
}: PortalShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isNavActive = (href: string) => {
    if (href === homeHref) {
      return pathname === href;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const displayName = user?.fullName || user?.email || 'Account';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'M';

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand header */}
      <div className="h-16 px-5 border-b border-surface-200 flex items-center justify-between gap-2 shrink-0">
        <Link
          href={homeHref}
          onClick={() => setMobileOpen(false)}
          className="flex items-center gap-2.5 min-w-0"
        >
          <Image
            src="/assets/logo.png"
            alt="MediRoute India"
            width={116}
            height={30}
            className="h-7 w-auto object-contain shrink-0"
            priority
          />
        </Link>
        <span className="text-[11px] font-semibold text-surface-500 bg-surface-100 border border-surface-200 px-2 py-0.5 rounded-md truncate">
          {portalName}
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label={`${portalName} navigation`}>
        {sections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-1">
            {section.label && (
              <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-surface-400">
                {section.label}
              </div>
            )}
            {section.items.map((item) => {
              const active = isNavActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    active
                      ? 'bg-primary-50 text-primary-800 font-semibold border-l-2 border-primary-600'
                      : 'text-surface-600 font-medium hover:bg-surface-100 hover:text-surface-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className={`shrink-0 ${active ? 'text-primary-700' : 'text-surface-400'}`}>
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="px-1.5 py-0.5 text-[11px] font-bold rounded-full bg-danger-50 text-danger-700 border border-danger-200">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Account footer */}
      <div className="p-3 border-t border-surface-200 bg-surface-50 shrink-0 space-y-2">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-800 flex items-center justify-center text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-surface-900 truncate">{displayName}</p>
            <p className="text-[11px] text-surface-500 truncate">
              {user?.roleLabel || portalName}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSignOut}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-surface-700 bg-white border border-surface-200 hover:bg-surface-100 hover:text-surface-900 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface-100 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 bg-white border-r border-surface-200 fixed inset-y-0 left-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden bg-surface-950/40"
          onClick={() => setMobileOpen(false)}
        >
          <aside
            className="w-72 max-w-[85vw] h-full bg-white border-r border-surface-200 shadow-md flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end p-2 border-b border-surface-200 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="p-1.5 rounded-lg text-surface-500 hover:text-surface-900 hover:bg-surface-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">{sidebarContent}</div>
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {alertBanner}

        <header className="sticky top-0 z-20 h-16 bg-white border-b border-surface-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden p-2 -ml-1 rounded-lg text-surface-600 hover:text-surface-900 hover:bg-surface-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              {pageTitle && (
                <p className="text-sm font-bold text-surface-900 truncate">{pageTitle}</p>
              )}
              {pageSubtitle && (
                <p className="text-xs text-surface-500 truncate hidden sm:block">{pageSubtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {headerActions}
            {showCurrencySelector && <CurrencySelector variant="header" />}
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
