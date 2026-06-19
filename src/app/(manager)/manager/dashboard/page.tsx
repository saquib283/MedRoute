/**
 * MediRoute India — Manager Dashboard (Placeholder)
 * Will be fully built in Phase 1.
 */

export default function ManagerDashboard() {
  return (
    <div className="min-h-screen bg-surface-950 p-4 sm:p-6 lg:p-8">
      <div className="animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-xl flex items-center justify-center shadow-glow">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <span className="text-xl font-bold gradient-text">MediRoute India</span>
        </div>
        <h1 className="text-3xl font-bold text-white">Manager Dashboard</h1>
        <p className="text-surface-400 mt-1">Manage your patient cohort</p>
      </div>
      <div className="glass-card rounded-2xl p-8 mt-8 text-center animate-slide-up">
        <div className="w-16 h-16 bg-surface-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-surface-300 mb-2">
          Patient Cohort Management
        </h3>
        <p className="text-surface-500 max-w-md mx-auto">
          Your manager dashboard with patient list, booking wizard, calendar, and
          coordination tools will be available in Phase 1.
        </p>
      </div>
    </div>
  );
}
