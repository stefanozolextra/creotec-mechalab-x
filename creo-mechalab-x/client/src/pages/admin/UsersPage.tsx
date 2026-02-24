import { Search, Plus, Pencil, Trash2, Mail, ChevronDown, X, Users as UsersIcon, SearchX, Settings2, Send } from 'lucide-react';
import { useMemo, useState, useEffect, useRef } from 'react';

type UserStatus = 'Done' | 'Active' | 'Inactive' | 'Pending';

const mockUsers = [
  { name: 'Juan Dela Cruz', id: '26001', email: 'juandelacruz@gmail.com', progressPct: 35, status: 'Active' as UserStatus },
  { name: 'Maria Clara', id: '26002', email: 'maria.clara@gmail.com', progressPct: 0, status: 'Pending' as UserStatus },
  { name: 'Andres Bonifacio', id: '26003', email: 'andres@gmail.com', progressPct: 85, status: 'Inactive' as UserStatus },
  { name: 'Jose Rizal', id: '26004', email: 'jose.rizal@gmail.com', progressPct: 100, status: 'Done' as UserStatus },
  { name: 'Emilio Aguinaldo', id: '26005', email: 'emilio@gmail.com', progressPct: 0, status: 'Pending' as UserStatus }, // Added another pending for testing
];

const statusPill = (s: UserStatus) => {
  if (s === 'Done') return 'bg-[#22C55E] text-white';
  if (s === 'Active') return 'bg-[#3B82F6] text-white';
  if (s === 'Pending') return 'bg-[#F59E0B] text-white';
  return 'bg-[#64748B] text-white';
};

export default function UsersPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'All' | UserStatus>('All');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);

  // Custom Dropdown State & Ref
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target as Node)) {
        setIsStatusOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ADD MODAL STATES
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [traineesToAdd, setTraineesToAdd] = useState([{ name: '', email: '' }]);

  // EDIT MODAL STATES
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [traineesToEdit, setTraineesToEdit] = useState<{ id: string, name: string, email: string }[]>([]);

  // SEND EMAIL MODAL STATES (NEW)
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isEmailModalVisible, setIsEmailModalVisible] = useState(false);
  const [selectedPending, setSelectedPending] = useState<string[]>([]);

  const rows = useMemo(() => {
    return mockUsers.filter((u) => {
      const matchesQuery =
        u.name.toLowerCase().includes(query.toLowerCase()) ||
        u.id.includes(query) ||
        u.email.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = status === 'All' ? true : u.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [query, status]);

  // Derived state for pending trainees only
  const pendingTrainees = useMemo(() => mockUsers.filter(u => u.status === 'Pending'), []);

  const handleSelectRow = (id: string) => {
    setSelectedRows(prev =>
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  // --- ADD MODAL HANDLERS ---
  const handleOpenAddModal = () => {
    setIsAddModalOpen(true);
    setTimeout(() => setIsModalVisible(true), 10);
  };

  const handleCloseAddModal = () => {
    setIsModalVisible(false);
    setTimeout(() => {
      setIsAddModalOpen(false);
      setTraineesToAdd([{ name: '', email: '' }]);
    }, 300);
  };

  const handleCountChange = (newCount: number) => {
    const count = Math.max(1, Math.min(50, newCount));
    const updated = [...traineesToAdd];
    if (count > updated.length) {
      while (updated.length < count) updated.push({ name: '', email: '' });
    } else {
      updated.length = count;
    }
    setTraineesToAdd(updated);
  };

  const handleTraineeAddChange = (index: number, field: 'name' | 'email', value: string) => {
    const updated = [...traineesToAdd];
    updated[index][field] = value;
    setTraineesToAdd(updated);
  };

  // --- EDIT MODAL HANDLERS ---
  const handleOpenEditModal = () => {
    const selectedData = mockUsers
      .filter(u => selectedRows.includes(u.id))
      .map(u => ({ id: u.id, name: u.name, email: u.email }));

    setTraineesToEdit(selectedData);
    setIsEditModalOpen(true);
    setTimeout(() => setIsEditModalVisible(true), 10);
  };

  const handleCloseEditModal = () => {
    setIsEditModalVisible(false);
    setTimeout(() => {
      setIsEditModalOpen(false);
      setTraineesToEdit([]);
    }, 300);
  };

  const handleTraineeEditChange = (id: string, field: 'name' | 'email', value: string) => {
    setTraineesToEdit(prev =>
      prev.map(t => t.id === id ? { ...t, [field]: value } : t)
    );
  };

  // --- EMAIL MODAL HANDLERS (NEW) ---
  const handleOpenEmailModal = () => {
    // Pre-select everyone who is pending to save the admin time
    setSelectedPending(pendingTrainees.map(t => t.id));
    setIsEmailModalOpen(true);
    setTimeout(() => setIsEmailModalVisible(true), 10);
  };

  const handleCloseEmailModal = () => {
    setIsEmailModalVisible(false);
    setTimeout(() => {
      setIsEmailModalOpen(false);
      setSelectedPending([]);
    }, 300);
  };

  const handleTogglePendingTrainee = (id: string) => {
    setSelectedPending(prev =>
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  const statusOptions: ('All' | UserStatus)[] = ['All', 'Active', 'Inactive', 'Done', 'Pending'];

  return (
    <div className="flex-1 flex flex-col gap-6 min-h-0 relative">

      {/* SECTION: TOOLBAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">

          <div className="relative z-10">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors duration-500" size={16} aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="pl-10 pr-4 py-2.5 rounded-full border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#1E293B] text-[#0B1B3D] dark:text-slate-200 text-sm font-semibold w-[240px] outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-500 shadow-sm"
            />
          </div>

          <div className="relative z-20" ref={statusDropdownRef}>
            <button
              onClick={() => setIsStatusOpen(!isStatusOpen)}
              className="bg-[#3B82F6] text-white text-sm font-bold py-2.5 pl-5 pr-10 rounded-full flex items-center justify-between shadow-sm hover:brightness-110 transition-all duration-300 w-[120px]"
            >
              {status === 'All' ? 'Status' : status}
              <ChevronDown
                size={16}
                className={`absolute right-4 transition-transform duration-300 ${isStatusOpen ? 'rotate-180' : ''}`}
              />
            </button>

            <div
              className={`absolute top-[calc(100%+8px)] left-0 w-40 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-xl overflow-hidden transform origin-top transition-all duration-200 ease-out ${isStatusOpen ? 'scale-100 opacity-100 pointer-events-auto' : 'scale-95 opacity-0 pointer-events-none'
                }`}
            >
              <div className="py-2">
                {statusOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      setStatus(opt);
                      setIsStatusOpen(false);
                    }}
                    className={`w-full text-left px-5 py-2.5 text-sm font-bold transition-colors ${status === opt
                        ? 'bg-blue-50 text-[#3B82F6] dark:bg-[#3B82F6]/20 dark:text-[#60A5FA]'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                      }`}
                  >
                    {opt === 'All' ? 'All Statuses' : opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 h-[42px] z-10 relative">
          <button
            onClick={handleOpenAddModal}
            className="bg-[#3B82F6] text-white px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all duration-300 hover:scale-105 shadow-sm hover:brightness-110"
          >
            <Plus size={16} aria-hidden="true" /> Add
          </button>

          {selectedRows.length > 0 && (
            <div className="flex items-center gap-3 animate-in fade-in slide-in-from-right-4 duration-300">
              <button
                onClick={handleOpenEditModal}
                className="bg-[#1E293B] dark:bg-slate-700 text-white px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all duration-300 hover:scale-105 shadow-sm hover:brightness-110"
              >
                <Pencil size={16} aria-hidden="true" />
                Edit {selectedRows.length > 1 ? `(${selectedRows.length})` : ''}
              </button>
              <button className="bg-[#DC2626] text-white px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all duration-300 hover:scale-105 shadow-sm hover:brightness-110">
                <Trash2 size={16} aria-hidden="true" />
                Delete {selectedRows.length > 1 ? `(${selectedRows.length})` : ''}
              </button>
            </div>
          )}

          {/* THE FIX: Wired up the Send to Emails button */}
          <button
            onClick={handleOpenEmailModal}
            className="bg-[#3B82F6] text-white px-5 py-2.5 rounded-full text-sm font-bold flex items-center gap-2 transition-all duration-300 hover:scale-105 shadow-sm hover:brightness-110"
          >
            <Mail size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Send to Emails</span>
          </button>
        </div>
      </div>

      {/* SECTION: DATA TABLE */}
      <div className="bg-white dark:bg-[#1E293B] rounded-3xl shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden transition-colors duration-500 relative z-0">
        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
          <table className="w-full text-sm whitespace-nowrap border-collapse">
            <thead className="sticky top-0 bg-white dark:bg-[#1E293B] z-10 transition-colors duration-500 after:content-[''] after:absolute after:bottom-0 after:left-4 after:right-4 after:border-b-2 after:border-slate-100 dark:after:border-slate-700/50">
              <tr className="text-[13px] uppercase font-extrabold text-[#0B1B3D] dark:text-slate-200 tracking-wider transition-colors duration-500">
                <th className="px-8 py-6 text-left">Name</th>
                <th className="px-6 py-6 text-center">Trainee ID</th>
                <th className="px-6 py-6 text-center">Email Address</th>
                <th className="px-6 py-6 text-center">Progress</th>
                <th className="px-8 py-6 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 transition-colors duration-500">
              {rows.map((u) => {
                const isSelected = selectedRows.includes(u.id);
                return (
                  <tr
                    key={u.id}
                    onClick={() => handleSelectRow(u.id)}
                    className={`group cursor-pointer select-none transition-all duration-300 border-y border-transparent ${isSelected
                        ? 'bg-blue-50/80 dark:bg-[#3B82F6]/10 !border-blue-200 dark:!border-blue-900/50 relative z-10'
                        : 'hover:bg-slate-50 dark:hover:bg-white/[0.02] hover:border-slate-200 dark:hover:border-slate-700/50'
                      }`}
                  >
                    <td className="px-8 py-5 text-left font-bold text-[#0B1B3D] dark:text-slate-200 transition-colors duration-500">{u.name}</td>
                    <td className="px-6 py-5 text-center text-slate-500 dark:text-slate-400 font-medium transition-colors duration-500">{u.id}</td>
                    <td className="px-6 py-5 text-center text-slate-500 dark:text-slate-400 font-medium transition-colors duration-500">{u.email}</td>
                    <td className="px-6 py-5">
                      <div className="w-[140px] mx-auto h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden transition-colors duration-500">
                        <div className="h-full bg-[#3B82F6] rounded-full transition-all duration-500" style={{ width: `${u.progressPct}%` }} />
                      </div>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className={`inline-flex items-center justify-center w-[90px] py-1.5 rounded-full text-[11px] font-black tracking-wide uppercase ${statusPill(u.status)} transition-colors duration-500`}>
                        {u.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-16 text-center text-slate-500 dark:text-slate-400 transition-colors duration-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <SearchX size={32} className="text-slate-300 dark:text-slate-600" />
                      <p className="font-semibold">No trainees found matching your filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================= */}
      {/* SECTION: ADD TRAINEE MODAL OVERLAY        */}
      {/* ========================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className={`absolute inset-0 bg-[#0B1B3D]/40 dark:bg-[#0F172A]/80 backdrop-blur-sm transition-opacity duration-300 ease-out ${isModalVisible ? 'opacity-100' : 'opacity-0'}`} onClick={handleCloseAddModal} />
          <div className={`relative w-full max-w-3xl h-[650px] max-h-[90vh] bg-white dark:bg-[#1E293B] rounded-3xl shadow-2xl flex flex-col mx-4 overflow-hidden transform transition-all duration-300 ease-out ${isModalVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20 shrink-0 transition-colors duration-500">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#3B82F6]/10 dark:bg-[#3B82F6]/20 text-[#3B82F6] rounded-xl">
                  <UsersIcon size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-[#0B1B3D] dark:text-slate-100 transition-colors duration-500">Add New Trainees</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors duration-500">Batch insert multiple trainees at once.</p>
                </div>
              </div>
              <button onClick={handleCloseAddModal} className="text-slate-400 hover:text-[#0B1B3D] dark:hover:text-slate-200 transition-colors bg-white dark:bg-[#0F172A] p-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm"><X size={20} /></button>
            </div>
            <div className="flex-1 p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 transition-colors duration-500">
              <div className="flex items-center justify-between p-5 bg-slate-50 dark:bg-[#0F172A]/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl mb-8 transition-colors duration-500">
                <div>
                  <label className="block text-[#0B1B3D] dark:text-slate-200 font-bold text-sm mb-1 transition-colors duration-500">Number of Trainees</label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium transition-colors duration-500">How many rows do you need?</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => handleCountChange(traineesToAdd.length - 1)} className="w-8 h-8 rounded-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-600 text-slate-500 flex items-center justify-center hover:text-[#0B1B3D] dark:hover:text-white transition-colors duration-500">-</button>
                  <input type="number" min="1" max="50" value={traineesToAdd.length} onChange={(e) => handleCountChange(parseInt(e.target.value) || 1)} className="w-16 text-center py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] text-[#0B1B3D] dark:text-slate-200 font-bold outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-500" />
                  <button onClick={() => handleCountChange(traineesToAdd.length + 1)} className="w-8 h-8 rounded-full bg-[#3B82F6] text-white flex items-center justify-center hover:bg-[#2563EB] transition-colors duration-500">+</button>
                </div>
              </div>
              <div className="space-y-4">
                {traineesToAdd.map((trainee, index) => (
                  <div key={index} className="flex gap-4 items-start">
                    <div className="w-8 h-11 shrink-0 flex items-center justify-center font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 transition-colors duration-500">{index + 1}</div>
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <input type="text" placeholder="Full Name" value={trainee.name} onChange={(e) => handleTraineeAddChange(index, 'name', e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-500 placeholder:text-slate-400" />
                      <input type="email" placeholder="Email Address" value={trainee.email} onChange={(e) => handleTraineeAddChange(index, 'email', e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-500 placeholder:text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20 shrink-0 flex justify-end gap-3 transition-colors duration-500">
              <button onClick={handleCloseAddModal} className="px-6 py-2.5 rounded-full text-sm font-bold text-slate-500 hover:text-[#0B1B3D] dark:hover:text-slate-200 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 transition-colors duration-500">Cancel</button>
              <button className="px-8 py-2.5 rounded-full text-sm font-bold text-white bg-[#3B82F6] hover:bg-[#2563EB] shadow-lg shadow-blue-500/20 transition-all hover:scale-105">Save Trainees</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* SECTION: EDIT TRAINEE MODAL OVERLAY       */}
      {/* ========================================= */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className={`absolute inset-0 bg-[#0B1B3D]/40 dark:bg-[#0F172A]/80 backdrop-blur-sm transition-opacity duration-300 ease-out ${isEditModalVisible ? 'opacity-100' : 'opacity-0'}`} onClick={handleCloseEditModal} />
          <div className={`relative w-full max-w-3xl h-[650px] max-h-[90vh] bg-white dark:bg-[#1E293B] rounded-3xl shadow-2xl flex flex-col mx-4 overflow-hidden transform transition-all duration-300 ease-out ${isEditModalVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20 shrink-0 transition-colors duration-500">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors duration-500">
                  <Settings2 size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-[#0B1B3D] dark:text-slate-100 transition-colors duration-500">Edit Trainees</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors duration-500">Update information for the selected trainees.</p>
                </div>
              </div>
              <button onClick={handleCloseEditModal} className="text-slate-400 hover:text-[#0B1B3D] dark:hover:text-slate-200 transition-colors bg-white dark:bg-[#0F172A] p-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm"><X size={20} /></button>
            </div>
            <div className="flex-1 p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 transition-colors duration-500">
              <div className="space-y-4">
                {traineesToEdit.map((trainee) => (
                  <div key={trainee.id} className="flex gap-4 items-start">
                    <div className="px-3 h-11 shrink-0 flex items-center justify-center text-xs font-black text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 transition-colors duration-500">#{trainee.id}</div>
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <input type="text" placeholder="Full Name" value={trainee.name} onChange={(e) => handleTraineeEditChange(trainee.id, 'name', e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-500 placeholder:text-slate-400" />
                      <input type="email" placeholder="Email Address" value={trainee.email} onChange={(e) => handleTraineeEditChange(trainee.id, 'email', e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-500 placeholder:text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20 shrink-0 flex justify-end gap-3 transition-colors duration-500">
              <button onClick={handleCloseEditModal} className="px-6 py-2.5 rounded-full text-sm font-bold text-slate-500 hover:text-[#0B1B3D] dark:hover:text-slate-200 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 transition-colors duration-500">Cancel</button>
              <button className="px-8 py-2.5 rounded-full text-sm font-bold text-white bg-[#1E293B] dark:bg-slate-600 hover:bg-[#0F172A] dark:hover:bg-slate-500 shadow-lg transition-all hover:scale-105">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* SECTION: SEND EMAIL MODAL OVERLAY (NEW)   */}
      {/* ========================================= */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div
            className={`absolute inset-0 bg-[#0B1B3D]/40 dark:bg-[#0F172A]/80 backdrop-blur-sm transition-opacity duration-300 ease-out ${isEmailModalVisible ? 'opacity-100' : 'opacity-0'}`}
            onClick={handleCloseEmailModal}
          />

          <div className={`relative w-full max-w-2xl bg-white dark:bg-[#1E293B] rounded-3xl shadow-2xl flex flex-col mx-4 overflow-hidden transform transition-all duration-300 ease-out ${isEmailModalVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>

            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20 shrink-0 transition-colors duration-500">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-500 rounded-xl transition-colors duration-500">
                  <Send size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-extrabold text-[#0B1B3D] dark:text-slate-100 transition-colors duration-500">Send Welcome Emails</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors duration-500">Review and select pending trainees to notify.</p>
                </div>
              </div>
              <button
                onClick={handleCloseEmailModal}
                className="text-slate-400 hover:text-[#0B1B3D] dark:hover:text-slate-200 transition-colors bg-white dark:bg-[#0F172A] p-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 max-h-[50vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 transition-colors duration-500">
              {pendingTrainees.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-500 dark:text-slate-400 transition-colors duration-500">
                  <Mail size={48} className="opacity-20 mb-4" />
                  <p className="font-bold text-lg text-[#0B1B3D] dark:text-slate-200 mb-1">No Pending Trainees</p>
                  <p className="text-sm">Everyone has already been invited!</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between px-4 py-2 mb-2 text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider transition-colors duration-500">
                    <span>Pending Trainees</span>
                    <button
                      onClick={() => setSelectedPending(selectedPending.length === pendingTrainees.length ? [] : pendingTrainees.map(t => t.id))}
                      className="text-[#3B82F6] hover:underline"
                    >
                      {selectedPending.length === pendingTrainees.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {pendingTrainees.map((trainee) => {
                      const isSelected = selectedPending.includes(trainee.id);
                      return (
                        <div
                          key={trainee.id}
                          onClick={() => handleTogglePendingTrainee(trainee.id)}
                          className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer border transition-all duration-300 ${isSelected
                              ? 'bg-blue-50/80 dark:bg-[#3B82F6]/10 border-blue-200 dark:border-blue-900/50'
                              : 'bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                            }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            readOnly
                            className="w-5 h-5 rounded-md border-slate-300 dark:border-slate-600 text-[#3B82F6] focus:ring-[#3B82F6] cursor-pointer transition-colors duration-500"
                          />
                          <div>
                            <p className="font-bold text-[#0B1B3D] dark:text-slate-200 transition-colors duration-500">{trainee.name}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors duration-500">{trainee.email}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20 shrink-0 flex justify-end gap-3 transition-colors duration-500">
              <button
                onClick={handleCloseEmailModal}
                className="px-6 py-2.5 rounded-full text-sm font-bold text-slate-500 hover:text-[#0B1B3D] dark:hover:text-slate-200 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 transition-colors duration-500"
              >
                Cancel
              </button>
              <button
                disabled={selectedPending.length === 0}
                className={`px-8 py-2.5 rounded-full text-sm font-bold text-white shadow-lg transition-all duration-300 ${selectedPending.length > 0
                    ? 'bg-[#F59E0B] hover:bg-[#D97706] shadow-amber-500/20 hover:scale-105'
                    : 'bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-500 cursor-not-allowed shadow-none'
                  }`}
              >
                Send Emails {selectedPending.length > 0 ? `(${selectedPending.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}