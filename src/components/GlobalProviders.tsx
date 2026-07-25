'use client';

/**
 * MediRoute India — Global Client Providers
 * Renders client-side providers (ToastContainer) that need 'use client'.
 */

import { ToastContainer } from '@/components/ui/Toast';
import { SessionTimeoutProvider } from '@/components/SessionTimeoutProvider';

export function GlobalProviders({ children }: { children?: React.ReactNode }) {
  return (
    <SessionTimeoutProvider>
      <ToastContainer />
      {children}
    </SessionTimeoutProvider>
  );
}

