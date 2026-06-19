/**
 * MediRoute India — Admin Dashboard (Placeholder)
 * Will be fully built in Phase 3.
 */

export default function AdminDashboard() {
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
        <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-surface-400 mt-1">Operations overview & configuration</p>
      </div>
      <div className="glass-card rounded-2xl p-8 mt-8 text-center animate-slide-up">
        <div className="w-16 h-16 bg-surface-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-accent-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-surface-300 mb-2">
          Analytics & Management
        </h3>
        <p className="text-surface-500 max-w-md mx-auto">
          KPI cards, charts, partner management, user management, and reporting 
          will be available in Phase 3.
        </p>
      </div>
    </div>
  );
}
