import { Search, Plus, Pencil, Trash2, X, BookOpen, Settings2, SearchX, ChevronRight, ChevronDown, Gamepad2, MousePointerClick, Upload, Info } from 'lucide-react';
import React, { useMemo, useState } from 'react';

// MOCK DATA
const mockLessons = [
  {
    id: '1', lesson: 'Lesson 1', title: 'Basic Electronics', fileName: 'Lesson_1_Intro.pdf', progressPct: 35,
    activities: [
      { id: 'a1', name: 'Simulation 1: Series Circuits', progressPct: 40 },
      { id: 'a2', name: 'Simulation 2: Parallel Circuits', progressPct: 30 }
    ]
  },
  {
    id: '2', lesson: 'Lesson 2', title: 'Microcontrollers', fileName: 'Lesson_2_Advanced.mp4', progressPct: 85,
    activities: [
      { id: 'a3', name: 'Simulation 3: Breadboard Wiring', progressPct: 90 },
      { id: 'a4', name: 'Simulation 4: LED Blinking Logic', progressPct: 80 }
    ]
  },
  {
    id: '3', lesson: 'Lesson 3', title: 'Sensors & Actuators', fileName: 'Mod_3_Sensors.docx', progressPct: 50,
    activities: [
      { id: 'a5', name: 'Simulation 5: Ultrasonic Sensor Read', progressPct: 50 }
    ]
  },
];

export default function LessonsPage() {
  const [query, setQuery] = useState('');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);

  // ADD MODAL STATES
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [lessonsToAdd, setLessonsToAdd] = useState([{ lesson: '', title: '', fileName: '' }]);
  const [activeAddDragIndex, setActiveAddDragIndex] = useState<number | null>(null); // NEW: Hover tracking

  // EDIT MODAL STATES
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [lessonsToEdit, setLessonsToEdit] = useState<{ id: string, lesson: string, title: string, fileName: string }[]>([]);
  const [activeEditDragId, setActiveEditDragId] = useState<string | null>(null); // NEW: Hover tracking

  // Filter Data
  const rows = useMemo(() => {
    return mockLessons.filter((l) => {
      const q = query.toLowerCase();
      return l.lesson.toLowerCase().includes(q) || l.title.toLowerCase().includes(q) || l.fileName.toLowerCase().includes(q);
    });
  }, [query]);

  // Handle Selection & Expansion
  const handleSelectRow = (id: string) => {
    setSelectedRows(prev =>
      prev.includes(id) ? prev.filter(rowId => rowId !== id) : [...prev, id]
    );
  };

  const toggleRowExpansion = (id: string) => {
    setExpandedRows(prev =>
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
      setLessonsToAdd([{ lesson: '', title: '', fileName: '' }]);
      setActiveAddDragIndex(null);
    }, 300);
  };

  const handleCountChange = (newCount: number) => {
    const count = Math.max(1, Math.min(50, newCount));
    const updated = [...lessonsToAdd];
    if (count > updated.length) {
      while (updated.length < count) updated.push({ lesson: '', title: '', fileName: '' });
    } else {
      updated.length = count;
    }
    setLessonsToAdd(updated);
  };

  const handleLessonAddChange = (index: number, field: 'lesson' | 'title' | 'fileName', value: string) => {
    const updated = [...lessonsToAdd];
    updated[index][field] = value;
    setLessonsToAdd(updated);
  };

  const handleDropAdd = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setActiveAddDragIndex(null); // Clear animation
    const file = e.dataTransfer.files?.[0];
    if (file) handleLessonAddChange(index, 'fileName', file.name);
  };

  // --- EDIT MODAL HANDLERS ---
  const handleOpenEditModal = () => {
    const selectedData = mockLessons
      .filter(l => selectedRows.includes(l.id))
      .map(l => ({ id: l.id, lesson: l.lesson, title: l.title, fileName: l.fileName }));

    setLessonsToEdit(selectedData);
    setIsEditModalOpen(true);
    setTimeout(() => setIsEditModalVisible(true), 10);
  };

  const handleCloseEditModal = () => {
    setIsEditModalVisible(false);
    setTimeout(() => {
      setIsEditModalOpen(false);
      setLessonsToEdit([]);
      setActiveEditDragId(null);
    }, 300);
  };

  const handleLessonEditChange = (id: string, field: 'lesson' | 'title' | 'fileName', value: string) => {
    setLessonsToEdit(prev =>
      prev.map(l => l.id === id ? { ...l, [field]: value } : l)
    );
  };

  const handleDropEdit = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    setActiveEditDragId(null); // Clear animation
    const file = e.dataTransfer.files?.[0];
    if (file) handleLessonEditChange(id, 'fileName', file.name);
  };

  return (
    <div className="flex-1 flex flex-col gap-6 min-h-0 relative">

      {/* SECTION: TOOLBAR */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 shrink-0">

        {/* Left Side: Search & Navigation Hint */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative z-10 shrink-0">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors duration-500" size={16} aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="pl-10 pr-4 py-2.5 rounded-full border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#1E293B] text-[#0B1B3D] dark:text-slate-200 text-sm font-semibold w-[280px] outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-500 shadow-sm"
            />
          </div>

          <div className="hidden sm:flex items-center gap-2.5 px-4 py-2 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700/50 rounded-full shadow-sm transition-colors duration-500">
            <MousePointerClick size={14} className="text-[#3B82F6]" />
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              <strong className="text-[#0B1B3D] dark:text-slate-200 font-bold">Left-click</strong> to expand
            </span>
            <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              <strong className="text-[#0B1B3D] dark:text-slate-200 font-bold">Right-click</strong> to select
            </span>
          </div>
        </div>

        {/* Right Side: Actions */}
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
        </div>
      </div>

      {/* SECTION: DATA TABLE */}
      <div className="bg-white dark:bg-[#1E293B] rounded-3xl shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden transition-colors duration-500 relative z-0">
        <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
          <table className="w-full text-sm whitespace-nowrap border-collapse">
            <thead className="sticky top-0 bg-white dark:bg-[#1E293B] z-10 transition-colors duration-500 after:content-[''] after:absolute after:bottom-0 after:left-4 after:right-4 after:border-b-2 after:border-slate-100 dark:after:border-slate-700/50">
              <tr className="text-[13px] uppercase font-extrabold text-[#0B1B3D] dark:text-slate-200 tracking-wider transition-colors duration-500">
                <th className="w-12 pl-6 pr-2 py-6 text-center"></th>
                <th className="px-6 py-6 text-center">Lesson</th>
                <th className="px-6 py-6 text-center">Title</th>
                <th className="px-6 py-6 text-center">File</th>
                <th className="px-8 py-6 text-center">Overall Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 transition-colors duration-500">
              {rows.map((l) => {
                const isSelected = selectedRows.includes(l.id);
                const isExpanded = expandedRows.includes(l.id);

                return (
                  <React.Fragment key={l.id}>
                    {/* MAIN LESSON ROW */}
                    <tr
                      onClick={() => toggleRowExpansion(l.id)}
                      onContextMenu={(e) => { e.preventDefault(); handleSelectRow(l.id); }}
                      className={`group cursor-pointer select-none transition-all duration-300 border-y border-transparent ${isSelected ? 'bg-blue-50/80 dark:bg-[#3B82F6]/10 !border-blue-200 dark:!border-blue-900/50 relative z-10'
                          : 'hover:bg-slate-50 dark:hover:bg-white/[0.02] hover:border-slate-200 dark:hover:border-slate-700/50'
                        }`}
                    >
                      <td className="w-12 pl-6 pr-2 py-5 text-center">
                        {l.activities && l.activities.length > 0 && (
                          <div className="p-1.5 rounded-full text-slate-400 group-hover:text-[#0B1B3D] dark:group-hover:text-slate-200 transition-colors">
                            {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-5 text-center font-bold text-[#0B1B3D] dark:text-slate-200 transition-colors duration-500">{l.lesson}</td>
                      <td className="px-6 py-5 text-center text-slate-500 dark:text-slate-400 font-medium transition-colors duration-500">{l.title}</td>
                      <td className="px-6 py-5 text-center">
                        <div className="flex justify-center">
                          <span title={l.fileName} className="inline-block max-w-[160px] truncate px-5 py-1.5 rounded-full bg-[#E2E8F0] dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 font-bold text-xs tracking-wide transition-colors duration-500">
                            {l.fileName}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="w-[180px] mx-auto h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden transition-colors duration-500">
                          <div className="h-full bg-[#3B82F6] rounded-full transition-all duration-500" style={{ width: `${l.progressPct}%` }} />
                        </div>
                      </td>
                    </tr>

                    {/* EXPANDED ACTIVITIES SUB-ROW */}
                    {isExpanded && l.activities && (
                      <tr className="bg-slate-50/50 dark:bg-[#1E293B]/50 transition-colors duration-500 shadow-inner">
                        <td colSpan={5} className="p-0 border-b-2 border-slate-100 dark:border-slate-800">
                          <div className="px-[88px] py-6 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                            <h4 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                              <Gamepad2 size={14} /> Virtual Simulations Included ({l.activities.length})
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {l.activities.map(act => (
                                <div key={act.id} className="flex items-center justify-between bg-white dark:bg-[#0F172A] p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 shadow-sm transition-colors duration-500">
                                  <span className="text-sm font-bold text-[#0B1B3D] dark:text-slate-200">{act.name}</span>
                                  <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{act.progressPct}%</span>
                                    <div className="w-[80px] h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                      <div className="h-full bg-cyan-400 rounded-full" style={{ width: `${act.progressPct}%` }} />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-16 text-center text-slate-500 dark:text-slate-400 transition-colors duration-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <SearchX size={32} className="text-slate-300 dark:text-slate-600" />
                      <p className="font-semibold">No lessons found matching your filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================= */}
      {/* SECTION: ADD LESSON MODAL OVERLAY         */}
      {/* ========================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className={`absolute inset-0 bg-[#0B1B3D]/40 dark:bg-[#0F172A]/80 backdrop-blur-sm transition-opacity duration-300 ease-out ${isModalVisible ? 'opacity-100' : 'opacity-0'}`} onClick={handleCloseAddModal} />

          <div className={`relative w-full max-w-4xl h-[650px] max-h-[90vh] bg-white dark:bg-[#1E293B] rounded-3xl shadow-2xl flex flex-col mx-4 overflow-hidden transform transition-all duration-300 ease-out ${isModalVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20 shrink-0 transition-colors duration-500">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#3B82F6]/10 dark:bg-[#3B82F6]/20 text-[#3B82F6] rounded-xl"><BookOpen size={24} /></div>
                <div>
                  <h2 className="text-xl font-extrabold text-[#0B1B3D] dark:text-slate-100 transition-colors duration-500">Add New Lessons</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors duration-500">Batch create multiple learning modules.</p>
                </div>
              </div>
              <button onClick={handleCloseAddModal} className="text-slate-400 hover:text-[#0B1B3D] dark:hover:text-slate-200 transition-colors bg-white dark:bg-[#0F172A] p-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm"><X size={20} /></button>
            </div>

            <div className="flex-1 p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 transition-colors duration-500">

              {/* THE FIX: Drag & Drop Hint Banner */}
              <div className="flex items-center gap-3 px-5 py-3 mb-6 bg-blue-50/50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 rounded-2xl text-sm font-medium border border-blue-100 dark:border-blue-900/30 transition-colors duration-500">
                <Info size={18} className="shrink-0" />
                <span><strong>Quick Tip:</strong> You can upload content faster by dragging and dropping files directly into the file slots below.</span>
              </div>

              <div className="flex items-center justify-between p-5 bg-slate-50 dark:bg-[#0F172A]/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl mb-8 transition-colors duration-500">
                <div>
                  <label className="block text-[#0B1B3D] dark:text-slate-200 font-bold text-sm mb-1 transition-colors duration-500">Number of Lessons</label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium transition-colors duration-500">How many rows do you need?</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => handleCountChange(lessonsToAdd.length - 1)} className="w-8 h-8 rounded-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-600 text-slate-500 flex items-center justify-center hover:text-[#0B1B3D] dark:hover:text-white transition-colors duration-500">-</button>
                  <input type="number" min="1" max="50" value={lessonsToAdd.length} onChange={(e) => handleCountChange(parseInt(e.target.value) || 1)} className="w-16 text-center py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] text-[#0B1B3D] dark:text-slate-200 font-bold outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-500" />
                  <button onClick={() => handleCountChange(lessonsToAdd.length + 1)} className="w-8 h-8 rounded-full bg-[#3B82F6] text-white flex items-center justify-center hover:bg-[#2563EB] transition-colors duration-500">+</button>
                </div>
              </div>

              <div className="space-y-4">
                {lessonsToAdd.map((lesson, index) => (
                  <div key={index} className="flex gap-4 items-start">
                    <div className="w-8 h-11 shrink-0 flex items-center justify-center font-bold text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 transition-colors duration-500">{index + 1}</div>
                    <div className="flex-1 grid grid-cols-3 gap-4">
                      <input type="text" placeholder="Lesson (e.g. Lesson 1)" value={lesson.lesson} onChange={(e) => handleLessonAddChange(index, 'lesson', e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-500 placeholder:text-slate-400" />
                      <input type="text" placeholder="Title (e.g. Module One)" value={lesson.title} onChange={(e) => handleLessonAddChange(index, 'title', e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-500 placeholder:text-slate-400" />

                      {/* THE FIX: Animated Dropzone for Add */}
                      <div className="relative w-full">
                        <input
                          type="file"
                          id={`file-add-${index}`}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleLessonAddChange(index, 'fileName', file.name);
                          }}
                        />
                        <label
                          htmlFor={`file-add-${index}`}
                          onDragEnter={(e) => { e.preventDefault(); setActiveAddDragIndex(index); }}
                          onDragOver={(e) => { e.preventDefault(); setActiveAddDragIndex(index); }}
                          onDragLeave={(e) => { e.preventDefault(); setActiveAddDragIndex(null); }}
                          onDrop={(e) => handleDropAdd(e, index)}
                          className={`w-full h-[42px] px-4 rounded-xl border border-dashed text-sm font-medium transition-all duration-300 flex items-center justify-between cursor-pointer group ${activeAddDragIndex === index
                              ? 'border-[#3B82F6] bg-blue-100 dark:bg-[#3B82F6]/30 scale-[1.03] shadow-md text-[#3B82F6] dark:text-[#60A5FA]' // Hover animation
                              : lesson.fileName
                                ? 'border-[#3B82F6] bg-blue-50/50 dark:bg-[#3B82F6]/10 text-[#3B82F6] dark:text-[#60A5FA]'
                                : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#0F172A] text-slate-400 hover:border-[#3B82F6] dark:hover:border-[#3B82F6] hover:bg-blue-50/50 dark:hover:bg-[#3B82F6]/10'
                            }`}
                        >
                          {/* pointer-events-none prevents text from interfering with drag events */}
                          <span className="truncate pr-2 pointer-events-none transition-colors">
                            {activeAddDragIndex === index ? "Drop it here!" : (lesson.fileName || "Click or Drag file...")}
                          </span>
                          <Upload size={16} className={`shrink-0 pointer-events-none transition-all duration-300 ${activeAddDragIndex === index ? 'animate-bounce' : 'group-hover:text-[#3B82F6] dark:group-hover:text-[#60A5FA]'}`} />
                        </label>
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20 shrink-0 flex justify-end gap-3 transition-colors duration-500">
              <button onClick={handleCloseAddModal} className="px-6 py-2.5 rounded-full text-sm font-bold text-slate-500 hover:text-[#0B1B3D] dark:hover:text-slate-200 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 transition-colors duration-500">Cancel</button>
              <button className="px-8 py-2.5 rounded-full text-sm font-bold text-white bg-[#3B82F6] hover:bg-[#2563EB] shadow-lg shadow-blue-500/20 transition-all hover:scale-105">Save Lessons</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* SECTION: EDIT LESSON MODAL OVERLAY        */}
      {/* ========================================= */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className={`absolute inset-0 bg-[#0B1B3D]/40 dark:bg-[#0F172A]/80 backdrop-blur-sm transition-opacity duration-300 ease-out ${isEditModalVisible ? 'opacity-100' : 'opacity-0'}`} onClick={handleCloseEditModal} />

          <div className={`relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-[#1E293B] rounded-3xl shadow-2xl flex flex-col mx-4 overflow-hidden transform transition-all duration-300 ease-out ${isEditModalVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20 shrink-0 transition-colors duration-500">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors duration-500"><Settings2 size={24} /></div>
                <div>
                  <h2 className="text-xl font-extrabold text-[#0B1B3D] dark:text-slate-100 transition-colors duration-500">Edit Lessons</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors duration-500">Update module details and files.</p>
                </div>
              </div>
              <button onClick={handleCloseEditModal} className="text-slate-400 hover:text-[#0B1B3D] dark:hover:text-slate-200 transition-colors bg-white dark:bg-[#0F172A] p-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm"><X size={20} /></button>
            </div>

            <div className="p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 transition-colors duration-500">

              {/* THE FIX: Drag & Drop Hint Banner */}
              <div className="flex items-center gap-3 px-5 py-3 mb-6 bg-blue-50/50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 rounded-2xl text-sm font-medium border border-blue-100 dark:border-blue-900/30 transition-colors duration-500">
                <Info size={18} className="shrink-0" />
                <span><strong>Quick Tip:</strong> You can replace existing files by dragging and dropping new ones directly into the file slots below.</span>
              </div>

              <div className="space-y-4">
                {lessonsToEdit.map((lesson) => (
                  <div key={lesson.id} className="flex gap-4 items-start">
                    <div className="px-3 h-11 shrink-0 flex items-center justify-center text-xs font-black text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 transition-colors duration-500">#{lesson.id}</div>
                    <div className="flex-1 grid grid-cols-3 gap-4">
                      <input type="text" placeholder="Lesson" value={lesson.lesson} onChange={(e) => handleLessonEditChange(lesson.id, 'lesson', e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-500 placeholder:text-slate-400" />
                      <input type="text" placeholder="Title" value={lesson.title} onChange={(e) => handleLessonEditChange(lesson.id, 'title', e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-500 placeholder:text-slate-400" />

                      {/* THE FIX: Animated Dropzone for Edit */}
                      <div className="relative w-full">
                        <input
                          type="file"
                          id={`file-edit-${lesson.id}`}
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleLessonEditChange(lesson.id, 'fileName', file.name);
                          }}
                        />
                        <label
                          htmlFor={`file-edit-${lesson.id}`}
                          onDragEnter={(e) => { e.preventDefault(); setActiveEditDragId(lesson.id); }}
                          onDragOver={(e) => { e.preventDefault(); setActiveEditDragId(lesson.id); }}
                          onDragLeave={(e) => { e.preventDefault(); setActiveEditDragId(null); }}
                          onDrop={(e) => handleDropEdit(e, lesson.id)}
                          className={`w-full h-[42px] px-4 rounded-xl border border-dashed text-sm font-medium transition-all duration-300 flex items-center justify-between cursor-pointer group ${activeEditDragId === lesson.id
                              ? 'border-[#3B82F6] bg-blue-100 dark:bg-[#3B82F6]/30 scale-[1.03] shadow-md text-[#3B82F6] dark:text-[#60A5FA]' // Hover animation
                              : lesson.fileName
                                ? 'border-[#3B82F6] bg-blue-50/50 dark:bg-[#3B82F6]/10 text-[#3B82F6] dark:text-[#60A5FA]'
                                : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#0F172A] text-slate-500 dark:text-slate-400 hover:border-[#3B82F6] dark:hover:border-[#3B82F6] hover:bg-blue-50/50 dark:hover:bg-[#3B82F6]/10'
                            }`}
                        >
                          <span className="truncate pr-2 pointer-events-none transition-colors">
                            {activeEditDragId === lesson.id ? "Drop it here!" : (lesson.fileName || "Click or Drag file...")}
                          </span>
                          <Upload size={16} className={`shrink-0 pointer-events-none transition-all duration-300 ${activeEditDragId === lesson.id ? 'animate-bounce' : 'group-hover:text-[#3B82F6] dark:group-hover:text-[#60A5FA]'}`} />
                        </label>
                      </div>

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

    </div>
  );
}