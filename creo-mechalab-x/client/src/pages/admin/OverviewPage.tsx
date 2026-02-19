const OverviewPage = () => {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Overview</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Active Trainees</p>
          <p className="mt-2 text-2xl font-semibold text-cyan-300">25</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Pending Reports</p>
          <p className="mt-2 text-2xl font-semibold text-amber-300">6</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">Today Activity</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-300">18 events</p>
        </div>
      </div>
    </section>
  );
};

export default OverviewPage;
