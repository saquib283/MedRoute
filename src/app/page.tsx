import { redirect } from 'next/navigation';

/**
 * Root page — redirects to login.
 * Authenticated users are redirected to their dashboard by middleware.
 */
export default function RootPage() {
  redirect('/login');
}
