const ActivityLogsPage = () => {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Activity Logs</h2>
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <ul className="space-y-3 text-sm text-slate-300">
          <li className="border-b border-slate-800 pb-2">[12:05] Admin generated trainee credentials</li>
          <li className="border-b border-slate-800 pb-2">[11:42] User TRAINEE26001 logged in</li>
          <li>[11:10] Batch status updated</li>
        </ul>
      </div>
    </section>
  );
};

export default ActivityLogsPage;
