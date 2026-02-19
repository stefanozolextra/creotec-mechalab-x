const UsersPage = () => {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-bold text-white">Trainees / Users</h2>
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-slate-400 uppercase text-xs">
            <tr>
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Username</th>
              <th className="py-2 pr-3">Status</th>
            </tr>
          </thead>
          <tbody className="text-slate-200">
            <tr className="border-t border-slate-800">
              <td className="py-3 pr-3">Sample Trainee</td>
              <td className="py-3 pr-3">TRAINEE26001</td>
              <td className="py-3 pr-3 text-emerald-300">Active</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default UsersPage;
