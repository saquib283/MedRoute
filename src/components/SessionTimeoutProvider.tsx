'use client';

/**
 * MediRoute India — Session Inactivity Timeout Provider
 * Mandated by HIPAA § 164.312(a)(2)(iii) Automatic Logoff Requirement.
 * Monitors user inactivity and automatically logs out users after 15 minutes of idleness.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const INACTIVITY_LIMIT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_THRESHOLD_MS = 13 * 60 * 1000; // 13 minutes (2 min warning)

export function SessionTimeoutProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(120);

  const lastActivityRef = useRef<number>(0);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Skip inactivity timeout on public auth routes
  const isPublicRoute =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/forgot-password' ||
    pathname === '/';

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/v1/auth/logout', { method: 'POST' });
    } catch {
      // Ignore network errors on auto-logout
    } finally {
      setShowWarning(false);
      router.push('/login?reason=timeout');
    }
  }, [router]);

  const resetTimers = useCallback(() => {
    lastActivityRef.current = Date.now();

    if (showWarning) {
      setShowWarning(false);
    }

    if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    if (isPublicRoute) return;

    // Set warning timer at 13 min
    warningTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      setRemainingSeconds(120);

      countdownIntervalRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, WARNING_THRESHOLD_MS);

    // Set hard logout timer at 15 min
    logoutTimerRef.current = setTimeout(() => {
      handleLogout();
    }, INACTIVITY_LIMIT_MS);
  }, [isPublicRoute, showWarning, handleLogout]);

  useEffect(() => {
    if (isPublicRoute) return;

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    const handleUserActivity = () => {
      // Throttle activity updates to once per 5 seconds
      if (Date.now() - lastActivityRef.current > 5000) {
        resetTimers();
      }
    };

    events.forEach((event) => window.addEventListener(event, handleUserActivity));
    queueMicrotask(() => resetTimers());

    return () => {
      events.forEach((event) => window.removeEventListener(event, handleUserActivity));
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [isPublicRoute, resetTimers]);

  return (
    <>
      {children}

      {showWarning && !isPublicRoute && (
        <div className="fixed bottom-5 right-5 z-[9999] max-w-md bg-white border-2 border-warning-500 shadow-2xl rounded-2xl p-5 animate-slide-up">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-warning-100 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6 text-warning-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-surface-900">Session Inactivity Warning</h3>
              <p className="text-xs text-surface-600 mt-1">
                Your session will expire in <span className="font-mono font-bold text-warning-700">{remainingSeconds}s</span> due to inactivity (HIPAA § 164.312).
              </p>
              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={resetTimers}
                  className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white font-medium text-xs rounded-lg transition-colors"
                >
                  Stay Logged In
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-1.5 bg-surface-200 hover:bg-surface-300 text-surface-700 font-medium text-xs rounded-lg transition-colors"
                >
                  Log Out Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
