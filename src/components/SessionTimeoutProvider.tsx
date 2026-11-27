'use client';

/**
 * Afzal Healthcare — Session Inactivity Timeout Provider
 * Mandated by HIPAA § 164.312(a)(2)(iii) Automatic Logoff Requirement.
 * Monitors user inactivity and automatically logs out users after the configured
 * sessionTimeoutMinutes of idleness (default 15 minutes).
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';

const DEFAULT_TIMEOUT_MINUTES = 15;

function clampTimeoutMinutes(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_TIMEOUT_MINUTES;
  }
  return Math.min(1440, Math.max(5, Math.round(value)));
}

export function SessionTimeoutProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [timeoutMinutes, setTimeoutMinutes] = useState(DEFAULT_TIMEOUT_MINUTES);
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(120);

  const lastActivityRef = useRef<number>(0);
  const lastRefreshRef = useRef<number>(0);
  const isRefreshingRef = useRef<boolean>(false);
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

  const inactivityLimitMs = timeoutMinutes * 60 * 1000;
  const warningThresholdMs = Math.max(60 * 1000, inactivityLimitMs - 2 * 60 * 1000);
  const warningCountdownSeconds = Math.max(
    1,
    Math.round((inactivityLimitMs - warningThresholdMs) / 1000)
  );
  const proactiveRefreshIntervalMs = Math.min(
    11 * 60 * 1000,
    Math.max(60 * 1000, inactivityLimitMs - 4 * 60 * 1000)
  );

  // Fetch configured sessionTimeoutMinutes from /api/v1/auth/me on entering protected routes
  useEffect(() => {
    if (isPublicRoute) return;

    let cancelled = false;
    fetch('/api/v1/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled || !json?.success) return;
        const nextMinutes = clampTimeoutMinutes(json.data?.sessionTimeoutMinutes);
        setTimeoutMinutes(nextMinutes);
      })
      .catch(() => {
        // Keep default timeout when offline or unauthenticated
      });

    return () => {
      cancelled = true;
    };
  }, [isPublicRoute]);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (isRefreshingRef.current) return false;
    isRefreshingRef.current = true;
    try {
      const res = await fetch('/api/v1/auth/refresh', { method: 'POST' });
      if (!res.ok) {
        setShowWarning(false);
        router.push('/login?reason=expired');
        return false;
      }
      lastRefreshRef.current = Date.now();
      return true;
    } catch {
      return false;
    } finally {
      isRefreshingRef.current = false;
    }
  }, [router]);

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

  const resetTimers = useCallback(
    (hideWarning = false) => {
      lastActivityRef.current = Date.now();

      if (hideWarning) {
        setShowWarning(false);
      }

      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

      if (isPublicRoute) return;

      warningTimerRef.current = setTimeout(() => {
        setShowWarning(true);
        setRemainingSeconds(warningCountdownSeconds);

        countdownIntervalRef.current = setInterval(() => {
          setRemainingSeconds((prev) => {
            if (prev <= 1) {
              if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }, warningThresholdMs);

      logoutTimerRef.current = setTimeout(() => {
        void handleLogout();
      }, inactivityLimitMs);
    },
    [
      isPublicRoute,
      handleLogout,
      inactivityLimitMs,
      warningThresholdMs,
      warningCountdownSeconds,
    ]
  );

  const handleStayLoggedIn = useCallback(async () => {
    const ok = await refreshSession();
    if (ok) {
      resetTimers(true);
    }
  }, [refreshSession, resetTimers]);

  useEffect(() => {
    if (isPublicRoute) return;

    const nowInit = Date.now();
    lastActivityRef.current = nowInit;
    lastRefreshRef.current = nowInit;

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];
    const handleUserActivity = () => {
      const now = Date.now();
      // Proactively refresh the 15-min access token before expiry while user is active
      if (!isRefreshingRef.current && now - lastRefreshRef.current > proactiveRefreshIntervalMs) {
        void refreshSession();
      }
      // Throttle activity updates to once per 5 seconds
      if (now - lastActivityRef.current > 5000) {
        resetTimers(true);
      }
    };

    events.forEach((event) => window.addEventListener(event, handleUserActivity));
    const initTimer = setTimeout(() => {
      resetTimers(false);
    }, 0);

    return () => {
      clearTimeout(initTimer);
      events.forEach((event) => window.removeEventListener(event, handleUserActivity));
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [isPublicRoute, resetTimers, refreshSession, proactiveRefreshIntervalMs]);

  return (
    <>
      {children}

      {showWarning && !isPublicRoute && (
        <div
          className="fixed bottom-5 right-5 z-[9999] max-w-sm bg-white border border-surface-300 shadow-md rounded-lg p-4 animate-slide-up"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-md bg-warning-50 border border-warning-200 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-warning-600" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-surface-900">Session Inactivity Warning</h3>
              <p className="text-xs text-surface-600 mt-1">
                Your session will expire in <span className="font-mono font-semibold text-warning-700 tabular-nums">{remainingSeconds}s</span> due to inactivity (HIPAA § 164.312).
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={handleStayLoggedIn}
                  className="min-h-11 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white font-medium text-xs rounded-md transition-colors"
                >
                  Stay signed in
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="min-h-11 px-3 py-1.5 bg-white hover:bg-surface-100 border border-surface-300 text-surface-700 font-medium text-xs rounded-md transition-colors"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
