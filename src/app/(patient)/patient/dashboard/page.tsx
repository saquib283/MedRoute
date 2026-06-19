/**
 * MediRoute India — Patient Dashboard (Placeholder)
 * Will be fully built in Phase 1.
 */

import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export default function PatientDashboard() {
  return (
    <div className="min-h-screen bg-surface-950 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center shadow-glow">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <span className="text-xl font-bold gradient-text">MediRoute India</span>
        </div>
        <h1 className="text-3xl font-bold text-white">Welcome back!</h1>
        <p className="text-surface-400 mt-1">Here&apos;s your medical journey overview</p>
      </div>

      {/* KPI Cards */}
      <div className="dashboard-grid mb-8 animate-slide-up">
        <Card hover>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary-900/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-surface-400">Case Status</p>
              <Badge variant="info" dot>Inquiry Received</Badge>
            </div>
          </div>
        </Card>

        <Card hover>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-accent-900/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-surface-400">Upcoming</p>
              <p className="text-lg font-semibold text-white">0 Appointments</p>
            </div>
          </div>
        </Card>

        <Card hover>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-success-700/30 flex items-center justify-center">
              <svg className="w-6 h-6 text-success-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-surface-400">Documents</p>
              <p className="text-lg font-semibold text-white">0 Uploaded</p>
            </div>
          </div>
        </Card>

        <Card hover>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-info-600/20 flex items-center justify-center">
              <svg className="w-6 h-6 text-info-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-surface-400">Messages</p>
              <p className="text-lg font-semibold text-white">0 Unread</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Phase 1 placeholder */}
      <Card className="animate-slide-up [animation-delay:200ms]">
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-surface-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17l-5.1-5.1m0 0L11.42 5 16.52 10.1m-5.1 5.07L16.52 10.1" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-surface-300 mb-2">
            Dashboard Coming Soon
          </h3>
          <p className="text-surface-500 max-w-md mx-auto">
            Your full patient dashboard — case status stepper, appointment timeline, 
            document vault, and messaging — is being built in Phase 1.
          </p>
        </div>
      </Card>
    </div>
  );
}
