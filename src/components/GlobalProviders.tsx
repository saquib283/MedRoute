'use client';

/**
 * MediRoute India — Global Client Providers
 * Renders client-side providers (ToastContainer) that need 'use client'.
 */

import { ToastContainer } from '@/components/ui/Toast';
import { SessionTimeoutProvider } from '@/components/SessionTimeoutProvider';
import { CurrencyProvider } from '@/lib/currency/CurrencyContext';

export function GlobalProviders({ children }: { children?: React.ReactNode }) {
  return (
    <CurrencyProvider>
      <SessionTimeoutProvider>
        <ToastContainer />
        {children}
      </SessionTimeoutProvider>
    </CurrencyProvider>
  );
}

