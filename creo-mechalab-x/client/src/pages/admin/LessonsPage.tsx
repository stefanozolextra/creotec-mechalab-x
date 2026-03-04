import { Search, Plus, Pencil, Trash2, X, BookOpen, Settings2, SearchX, Gamepad2, MousePointerClick, Upload, Info, Link as LinkIcon, FileText, Check, Layers, AlertTriangle } from 'lucide-react';
import React, { useMemo, useState } from 'react';

// HARDCODED AVAILABLE SIMULATIONS
const AVAILABLE_SIMULATIONS = [
  { id: 'a1', name: 'Simulation 1: Series Circuits' },
  { id: 'a2', name: 'Simulation 2: Parallel Circuits' },
  { id: 'a3', name: 'Simulation 3: Breadboard Wiring' },
  { id: 'a4', name: 'Simulation 4: LED Blinking Logic' },
  { id: 'a5', name: 'Simulation 5: Ultrasonic Sensor Read' },
  { id: 'a6', name: 'Simulation 6: Motor Control' },
];

// INITIAL MOCK DATA
const initialMockLessons = [
  {
    id: '1', lesson: 'Lesson 1', title: 'Basic Electronics', progressPct: 35,
    contents: [
      { id: 'c1', name: 'Introduction Handout', fileName: 'Lesson_1_Intro.pdf', isLink: false },
      { id: 'c2', name: 'Video: Core Concepts', fileName: 'https://youtube.com/watch?v=intro', isLink: true }
    ],
    activities: [
      { id: 'a1', name: 'Simulation 1: Series Circuits', progressPct: 40 },
      { id: 'a2', name: 'Simulation 2: Parallel Circuits', progressPct: 30 }
    ]
  },
  {
    id: '2', lesson: 'Lesson 2', title: 'Microcontrollers', progressPct: 85,
    contents: [
      { id: 'c3', name: 'Arduino Setup Guide', fileName: 'https://youtube.com/watch?v=dQw4w9WgXcQ', isLink: true }
    ],
    activities: [
      { id: 'a3', name: 'Simulation 3: Breadboard Wiring', progressPct: 90 },
      { id: 'a4', name: 'Simulation 4: LED Blinking Logic', progressPct: 80 }
    ]
  },
  {
    id: '3', lesson: 'Lesson 3', title: 'Sensors & Actuators', progressPct: 50,
    contents: [
      { id: 'c4', name: 'Sensors Module Overview', fileName: 'Mod_3_Sensors.docx', isLink: false },
      { id: 'c5', name: 'Ultrasonic Datasheet', fileName: 'Sensor_Datasheet.pdf', isLink: false }
    ],
    activities: [
      { id: 'a5', name: 'Simulation 5: Ultrasonic Sensor Read', progressPct: 50 }
    ]
  },
];

type ContentItem = { id?: string, name: string, fileName: string, isLink: boolean };
type LessonForm = { id?: string, lesson: string, title: string, contents: ContentItem[], selectedSimulations: string[] };

export default function LessonsPage() {
  const [query, setQuery] = useState('');

  // STATE: Interactive Data
  const [lessons, setLessons] = useState(initialMockLessons);

  // SPLIT-VIEW STATE
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);

  // ADD MODAL STATES
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [lessonsToAdd, setLessonsToAdd] = useState<LessonForm[]>([{ lesson: '', title: '', contents: [{ name: '', fileName: '', isLink: false }], selectedSimulations: [] }]);
  const [activeAddDragId, setActiveAddDragId] = useState<string | null>(null);

  // EDIT MODAL STATES
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [lessonsToEdit, setLessonsToEdit] = useState<LessonForm[]>([]);
  const [activeEditDragId, setActiveEditDragId] = useState<string | null>(null);

  // DELETE MODAL STATES
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);

  // Filter Data
  const rows = useMemo(() => {
    return lessons.filter((l) => {
      const q = query.toLowerCase();
      const matchesLesson = l.lesson.toLowerCase().includes(q) || l.title.toLowerCase().includes(q);
      const matchesContent = l.contents.some(c => c.name.toLowerCase().includes(q) || c.fileName.toLowerCase().includes(q));
      return matchesLesson || matchesContent;
    });
  }, [query, lessons]);

  const activeLesson = useMemo(() => {
    return rows.find(r => r.id === activeLessonId) || null;
  }, [rows, activeLessonId]);

  // Handle Selection
  const handleRowClick = (id: string) => {
    setActiveLessonId(activeLessonId === id ? null : id);
  };

  // --- DELETE MODAL HANDLERS ---
  const handleOpenDeleteModal = () => {
    setIsDeleteModalOpen(true);
    setTimeout(() => setIsDeleteModalVisible(true), 10);
  };

  const handleCloseDeleteModal = () => {
    setIsDeleteModalVisible(false);
    setTimeout(() => {
      setIsDeleteModalOpen(false);
    }, 300);
  };

  const handleConfirmDelete = () => {
    if (activeLessonId) {
      setLessons(prev => prev.filter(l => l.id !== activeLessonId));
      setActiveLessonId(null);
    }
    handleCloseDeleteModal();
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
      setLessonsToAdd([{ lesson: '', title: '', contents: [{ name: '', fileName: '', isLink: false }], selectedSimulations: [] }]);
      setActiveAddDragId(null);
    }, 300);
  };

  const handleAddModuleCountChange = (newCount: number) => {
    const count = Math.max(1, Math.min(50, newCount));
    const updated = [...lessonsToAdd];
    if (count > updated.length) {
      while (updated.length < count) updated.push({ lesson: '', title: '', contents: [{ name: '', fileName: '', isLink: false }], selectedSimulations: [] });
    } else {
      updated.length = count;
    }
    setLessonsToAdd(updated);
  };

  const handleAddLessonFieldChange = (lIndex: number, field: 'lesson' | 'title', value: string) => {
    const updated = [...lessonsToAdd];
    updated[lIndex][field] = value;
    setLessonsToAdd(updated);
  };

  const handleAddContentFieldChange = (lIndex: number, cIndex: number, field: 'name' | 'fileName' | 'isLink', value: string | boolean) => {
    const updated = [...lessonsToAdd];
    updated[lIndex].contents[cIndex] = { ...updated[lIndex].contents[cIndex], [field]: value };
    if (field === 'isLink') updated[lIndex].contents[cIndex].fileName = '';
    setLessonsToAdd(updated);
  };

  const handleAddSimulationToggle = (lIndex: number, simId: string) => {
    const updated = [...lessonsToAdd];
    const sims = updated[lIndex].selectedSimulations;
    if (sims.includes(simId)) {
      updated[lIndex].selectedSimulations = sims.filter(id => id !== simId);
    } else {
      updated[lIndex].selectedSimulations = [...sims, simId];
    }
    setLessonsToAdd(updated);
  };

  const addNewContentToAddLesson = (lIndex: number) => {
    const updated = [...lessonsToAdd];
    updated[lIndex].contents.push({ name: '', fileName: '', isLink: false });
    setLessonsToAdd(updated);
  };

  const removeContentFromAddLesson = (lIndex: number, cIndex: number) => {
    const updated = [...lessonsToAdd];
    updated[lIndex].contents.splice(cIndex, 1);
    setLessonsToAdd(updated);
  };

  const handleDropAdd = (e: React.DragEvent, lIndex: number, cIndex: number) => {
    e.preventDefault();
    setActiveAddDragId(null);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleAddContentFieldChange(lIndex, cIndex, 'fileName', file.name);
      if (!lessonsToAdd[lIndex].contents[cIndex].name) {
        handleAddContentFieldChange(lIndex, cIndex, 'name', file.name.split('.').slice(0, -1).join('.'));
      }
    }
  };

  const handleSaveAdd = () => {
    const newLessons = lessonsToAdd.map((l, idx) => {
      const activities = l.selectedSimulations.map(simId => {
        const sim = AVAILABLE_SIMULATIONS.find(s => s.id === simId);
        return { id: simId, name: sim?.name || '', progressPct: 0 };
      });

      const contents = l.contents.map((c, cIdx) => ({
        ...c,
        id: `c-new-${Date.now()}-${idx}-${cIdx}`
      }));

      return {
        id: `new-${Date.now()}-${idx}`,
        lesson: l.lesson || 'New Lesson',
        title: l.title || 'Untitled Module',
        progressPct: 0,
        contents,
        activities
      };
    });

    setLessons(prev => [...prev, ...newLessons]);
    handleCloseAddModal();
  };

  // --- EDIT MODAL HANDLERS ---
  const handleOpenEditModal = () => {
    if (!activeLesson) return;
    const selectedData = [{
      id: activeLesson.id,
      lesson: activeLesson.lesson,
      title: activeLesson.title,
      contents: activeLesson.contents.map(c => ({ ...c })),
      selectedSimulations: activeLesson.activities ? activeLesson.activities.map(a => a.id) : []
    }];

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

  const handleEditLessonFieldChange = (field: 'lesson' | 'title', value: string) => {
    setLessonsToEdit(prev => {
      const updated = [...prev];
      updated[0][field] = value;
      return updated;
    });
  };

  const handleEditContentFieldChange = (cIndex: number, field: 'name' | 'fileName' | 'isLink', value: string | boolean) => {
    setLessonsToEdit(prev => {
      const updated = [...prev];
      updated[0].contents[cIndex] = { ...updated[0].contents[cIndex], [field]: value };
      if (field === 'isLink') updated[0].contents[cIndex].fileName = '';
      return updated;
    });
  };

  const handleEditSimulationToggle = (simId: string) => {
    setLessonsToEdit(prev => {
      const updated = [...prev];
      const sims = updated[0].selectedSimulations;
      updated[0].selectedSimulations = sims.includes(simId) ? sims.filter(id => id !== simId) : [...sims, simId];
      return updated;
    });
  };

  const addNewContentToEditLesson = () => {
    setLessonsToEdit(prev => {
      const updated = [...prev];
      updated[0].contents.push({ name: '', fileName: '', isLink: false });
      return updated;
    });
  };

  const removeContentFromEditLesson = (cIndex: number) => {
    setLessonsToEdit(prev => {
      const updated = [...prev];
      updated[0].contents.splice(cIndex, 1);
      return updated;
    });
  };

  const handleDropEdit = (e: React.DragEvent, cIndex: number) => {
    e.preventDefault();
    setActiveEditDragId(null);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleEditContentFieldChange(cIndex, 'fileName', file.name);
      const currentLesson = lessonsToEdit[0];
      if (currentLesson && !currentLesson.contents[cIndex].name) {
        handleEditContentFieldChange(cIndex, 'name', file.name.split('.').slice(0, -1).join('.'));
      }
    }
  };

  const handleSaveEdit = () => {
    if (lessonsToEdit.length === 0) return;

    const editedForm = lessonsToEdit[0];
    const activities = editedForm.selectedSimulations.map(simId => {
      const sim = AVAILABLE_SIMULATIONS.find(s => s.id === simId);
      return { id: simId, name: sim?.name || '', progressPct: 0 };
    });

    const updatedContents = editedForm.contents.map((c, idx) => ({
      ...c,
      id: c.id || `c-edit-${Date.now()}-${idx}`
    }));

    setLessons(prev => prev.map(l => {
      if (l.id !== editedForm.id) return l;
      return {
        ...l,
        lesson: editedForm.lesson,
        title: editedForm.title,
        contents: updatedContents,
        activities
      };
    }));

    handleCloseEditModal();
  };

  // --- MUTUAL EXCLUSIVITY LOGIC ---
  const getAvailableSimsForAdd = (currentLIndex: number) => {
    return AVAILABLE_SIMULATIONS.filter(sim => {
      const usedInOtherAdd = lessonsToAdd.some((l, idx) => idx !== currentLIndex && l.selectedSimulations.includes(sim.id));
      const usedGlobally = lessons.some(l => l.activities?.some(a => a.id === sim.id));
      return !usedInOtherAdd && !usedGlobally;
    });
  };

  const getAvailableSimsForEdit = (currentLessonId: string) => {
    return AVAILABLE_SIMULATIONS.filter(sim => {
      const usedInOtherGlobal = lessons.some(l => l.id !== currentLessonId && l.activities?.some(a => a.id === sim.id));
      return !usedInOtherGlobal;
    });
  };

  return (
    <div className="flex-1 flex flex-col gap-4 sm:gap-6 min-h-0 relative w-full">

      {/* SECTION: TOOLBAR */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 shrink-0 z-20 w-full min-w-0">

        {/* Left Side: Search & Add Button Side-by-Side */}
        <div className="flex flex-row flex-wrap sm:flex-nowrap items-center gap-3 w-full xl:w-auto flex-1 min-w-0">

          {/* Search Bar */}
          <div className="relative flex-1 min-w-[200px] sm:max-w-[320px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors duration-500" size={16} aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search lessons..."
              className="pl-10 pr-4 py-2.5 rounded-full border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#1E293B] text-[#0B1B3D] dark:text-slate-200 text-sm font-semibold w-full outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-500 shadow-sm"
            />
          </div>

          {/* Add Module Button */}
          <button
            onClick={handleOpenAddModal}
            className="bg-[#3B82F6] text-white px-5 sm:px-6 py-2.5 rounded-full text-sm font-bold flex items-center justify-center gap-2 transition-all duration-300 hover:scale-105 shadow-sm hover:brightness-110 shrink-0"
          >
            <Plus size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Add New Module</span>
            <span className="sm:hidden">Add</span>
          </button>

        </div>

        {/* Right Side: Navigation Hint */}
        <div className="hidden xl:flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 dark:border-slate-700/50 bg-white/50 dark:bg-[#1E293B]/30 text-xs select-none shadow-sm shrink-0 ml-auto">
          <MousePointerClick size={14} className="text-[#3B82F6]" />
          <span className="text-slate-500 dark:text-slate-400 font-medium">
            <strong className="text-slate-700 dark:text-slate-200 font-bold">Left-click</strong> a row <span className="opacity-80">to view details</span>
          </span>
        </div>

      </div>

      {/* SECTION: SPLIT VIEW CONTAINER */}
      <div className="flex-1 flex gap-6 min-h-0 w-full">

        {/* LEFT PANEL: Master Table */}
        <div className="flex-1 min-w-0 bg-white dark:bg-[#1E293B] rounded-3xl shadow-sm flex flex-col overflow-hidden transition-colors duration-500 border border-slate-100 dark:border-slate-800/50">
          <div className="flex-1 overflow-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">

            <table className="w-full text-sm border-collapse text-left min-w-[700px]">
              <thead className="sticky top-0 bg-white dark:bg-[#1E293B] z-10 transition-colors duration-500 after:content-[''] after:absolute after:bottom-0 after:left-0 after:right-0 after:border-b-2 after:border-slate-100 dark:after:border-slate-700/50">
                <tr className="text-[11px] uppercase font-extrabold text-[#0B1B3D] dark:text-slate-200 tracking-wider transition-colors duration-500">
                  <th className="px-6 py-5 text-left whitespace-nowrap w-[150px]">Module Code</th>
                  <th className="px-4 py-5 text-left w-auto">Module Title</th>
                  <th className="px-4 py-5 text-center whitespace-nowrap w-[150px]">Assets</th>
                  <th className="px-6 py-5 text-right pr-8 whitespace-nowrap w-[200px]">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 transition-colors duration-500">
                {rows.map((l) => {
                  const isActive = activeLessonId === l.id;

                  const rowClasses = isActive
                    ? 'bg-blue-50/60 dark:bg-[#3B82F6]/10 border-[#3B82F6]'
                    : 'border-transparent hover:bg-slate-50 dark:hover:bg-white/[0.02] hover:border-slate-300 dark:hover:border-slate-600';

                  return (
                    <tr
                      key={l.id}
                      onClick={() => handleRowClick(l.id)}
                      className={`group cursor-pointer select-none transition-all duration-300 border-l-4 ${rowClasses}`}
                    >
                      <td className="px-6 py-5 text-left whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-colors duration-300 shrink-0 ${isActive ? 'bg-[#3B82F6] text-white shadow-md shadow-blue-500/30' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                            {l.lesson.replace('Lesson ', 'L')}
                          </div>
                          <span className="font-extrabold text-sm text-[#0B1B3D] dark:text-slate-200 transition-colors duration-500">{l.lesson}</span>
                        </div>
                      </td>

                      <td className="px-4 py-5 text-slate-500 dark:text-slate-400 font-bold transition-colors duration-500 whitespace-normal break-words">
                        {l.title}
                      </td>

                      <td className="px-4 py-5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          {l.contents.length > 0 && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[10px] sm:text-xs font-bold shadow-sm transition-colors">
                              <FileText size={12} className="text-[#3B82F6]" /> {l.contents.length}
                            </span>
                          )}
                          {l.activities && l.activities.length > 0 && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[10px] sm:text-xs font-bold shadow-sm transition-colors">
                              <Gamepad2 size={12} className="text-emerald-500" /> {l.activities.length}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-5 text-right pr-8 whitespace-nowrap">
                        <div className="w-[120px] xl:w-[150px] ml-auto group-hover:scale-105 transition-transform duration-300">
                          <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-bold mb-1.5 uppercase tracking-wider">
                            <span>Completion</span>
                            <span className={l.progressPct === 100 ? "text-emerald-500" : ""}>{l.progressPct}%</span>
                          </div>
                          <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden transition-colors duration-500">
                            <div className={`h-full rounded-full transition-all duration-500 ${l.progressPct === 100 ? 'bg-emerald-500' : 'bg-[#3B82F6]'}`} style={{ width: `${l.progressPct}%` }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center text-slate-500 dark:text-slate-400 transition-colors duration-500">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <SearchX size={40} className="text-slate-300 dark:text-slate-600" />
                        <p className="font-semibold text-lg text-[#0B1B3D] dark:text-slate-200">No modules found.</p>
                        <p className="text-sm">Try adjusting your search query.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT PANEL: Module Details Sidebar */}
        <div className="w-[300px] lg:w-[350px] xl:w-[400px] shrink-0 bg-white dark:bg-[#1E293B] rounded-3xl shadow-sm flex flex-col overflow-hidden transition-colors duration-500 border border-slate-100 dark:border-slate-800/50">

          {activeLesson ? (
            <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-300">

              {/* Sidebar Header with Edit & Delete Actions */}
              <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-700/50 shrink-0 flex items-center justify-between bg-slate-50/50 dark:bg-[#0B1120]/30">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 pr-2">
                  <BookOpen size={18} className="text-[#3B82F6] shrink-0" />
                  <h3 className="hidden xl:inline-block text-sm font-black text-[#0B1B3D] dark:text-slate-200 uppercase tracking-widest truncate">
                    Details
                  </h3>
                  <span className="text-[10px] font-bold text-[#3B82F6] bg-blue-50 dark:bg-[#3B82F6]/10 border border-blue-200 dark:border-blue-900/50 px-2.5 py-1 rounded-full shadow-sm shrink-0">
                    {activeLesson.lesson}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={handleOpenEditModal} className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-blue-50 dark:bg-[#1E293B] dark:hover:bg-[#3B82F6]/20 text-slate-500 hover:text-[#3B82F6] dark:text-slate-400 dark:hover:text-[#60A5FA] border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold transition-colors shadow-sm">
                    <Pencil size={14} /> <span className="hidden sm:inline">Edit</span>
                  </button>
                  <button onClick={handleOpenDeleteModal} className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-red-50 dark:bg-[#1E293B] dark:hover:bg-red-900/20 text-slate-500 hover:text-red-500 dark:text-slate-400 dark:hover:text-red-400 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold transition-colors shadow-sm">
                    <Trash2 size={14} /> <span className="hidden sm:inline">Delete</span>
                  </button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 bg-slate-50/30 dark:bg-transparent">

                {/* Prominent Title */}
                <h2 className="text-xl sm:text-2xl font-black text-[#0B1B3D] dark:text-slate-100 mb-6 leading-tight break-words">
                  {activeLesson.title}
                </h2>

                {/* Materials Section */}
                <div className="mb-8">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Layers size={14} /> Attached Materials ({activeLesson.contents.length})
                  </h4>

                  {activeLesson.contents.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      {activeLesson.contents.map(c => (
                        <div key={c.id} className="p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#1E293B] shadow-sm hover:border-[#3B82F6]/50 transition-colors flex items-start gap-3">
                          <div className={`p-2 rounded-xl shrink-0 ${c.isLink ? 'bg-red-50 dark:bg-red-900/20 text-red-500' : 'bg-blue-50 dark:bg-[#3B82F6]/10 text-[#3B82F6]'}`}>
                            {c.isLink ? <LinkIcon size={16} /> : <FileText size={16} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h5 className="font-extrabold text-sm text-[#0B1B3D] dark:text-slate-200 truncate">{c.name || "Unnamed Material"}</h5>
                            {c.isLink ? (
                              <a href={c.fileName} target="_blank" rel="noopener noreferrer" className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 hover:text-[#3B82F6] truncate block mt-0.5 transition-colors">{c.fileName}</a>
                            ) : (
                              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{c.fileName}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 px-4 bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-700/50 border-dashed">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">No materials attached.</p>
                    </div>
                  )}
                </div>

                {/* Simulations Section */}
                <div>
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Gamepad2 size={14} /> Assigned Simulations ({(activeLesson.activities || []).length})
                  </h4>

                  {(activeLesson.activities && activeLesson.activities.length > 0) ? (
                    <div className="flex flex-col gap-3">
                      {activeLesson.activities.map(act => (
                        <div key={act.id} className="p-3 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-700/50 bg-white dark:bg-[#1E293B] shadow-sm hover:border-[#3B82F6]/50 transition-colors">
                          <div className="flex justify-between items-center mb-3">
                            <h5 className="font-bold text-sm text-[#0B1B3D] dark:text-slate-200 line-clamp-2">{act.name}</h5>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${act.progressPct}%` }} />
                            </div>
                            <span className="text-[10px] sm:text-xs font-black text-slate-500 dark:text-slate-400 w-8 text-right">{act.progressPct}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 px-4 bg-white dark:bg-[#1E293B] rounded-2xl border border-slate-200 dark:border-slate-700/50 border-dashed">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">No simulations assigned.</p>
                    </div>
                  )}
                </div>

              </div>
            </div>
          ) : (
            // Empty State (No Lesson Selected)
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50 dark:bg-transparent animate-in fade-in duration-500">
              <div className="w-20 h-20 bg-blue-50 dark:bg-[#3B82F6]/10 rounded-full flex items-center justify-center mb-4 border-4 border-white dark:border-[#1E293B] shadow-sm">
                <MousePointerClick size={32} className="text-[#3B82F6] ml-1 mt-1" />
              </div>
              <h3 className="text-xl font-extrabold text-[#0B1B3D] dark:text-slate-200 mb-2">View Details</h3>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-[250px] leading-relaxed">
                Click on any module from the list on the left to view its contents, assign simulations, or edit its details.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* ========================================= */}
      {/* SECTION: ADD LESSON MODAL OVERLAY         */}
      {/* ========================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className={`absolute inset-0 bg-[#0B1B3D]/40 dark:bg-[#0F172A]/80 backdrop-blur-sm transition-opacity duration-300 ease-out ${isModalVisible ? 'opacity-100' : 'opacity-0'}`} onClick={handleCloseAddModal} />

          <div className={`relative w-full max-w-5xl h-[650px] max-h-[90vh] bg-white dark:bg-[#1E293B] rounded-3xl shadow-2xl flex flex-col overflow-hidden transform transition-all duration-300 ease-out ${isModalVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20 shrink-0 transition-colors duration-500">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-[#3B82F6]/10 dark:bg-[#3B82F6]/20 text-[#3B82F6] rounded-xl"><BookOpen size={24} /></div>
                <div>
                  <h2 className="text-xl font-extrabold text-[#0B1B3D] dark:text-slate-100 transition-colors duration-500">Add New Module</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors duration-500">Create a module, attach materials, and assign simulations.</p>
                </div>
              </div>
              <button onClick={handleCloseAddModal} className="text-slate-400 hover:text-[#0B1B3D] dark:hover:text-slate-200 transition-colors bg-white dark:bg-[#0F172A] p-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm"><X size={20} /></button>
            </div>

            <div className="flex-1 p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 transition-colors duration-500">

              <div className="flex items-center gap-3 px-5 py-3 mb-6 bg-blue-50/50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 rounded-2xl text-sm font-medium border border-blue-100 dark:border-blue-900/30 transition-colors duration-500">
                <Info size={18} className="shrink-0" />
                <span><strong>Simulations:</strong> After adding your module details and materials, click the pills below to assign specific virtual simulations to this module.</span>
              </div>

              <div className="flex items-center justify-between p-5 bg-slate-50 dark:bg-[#0F172A]/50 border border-slate-200 dark:border-slate-700/50 rounded-2xl mb-6 transition-colors duration-500">
                <div>
                  <label className="block text-[#0B1B3D] dark:text-slate-200 font-bold text-sm mb-1 transition-colors duration-500">Number of Modules</label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium transition-colors duration-500">How many distinct lesson blocks do you need to create?</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => handleAddModuleCountChange(lessonsToAdd.length - 1)} className="w-8 h-8 rounded-full bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-600 text-slate-500 flex items-center justify-center hover:text-[#0B1B3D] dark:hover:text-white transition-colors duration-500">-</button>
                  <input type="number" min="1" max="50" value={lessonsToAdd.length} onChange={(e) => handleAddModuleCountChange(parseInt(e.target.value) || 1)} className="w-16 text-center py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] text-[#0B1B3D] dark:text-slate-200 font-bold outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-500" />
                  <button onClick={() => handleAddModuleCountChange(lessonsToAdd.length + 1)} className="w-8 h-8 rounded-full bg-[#3B82F6] text-white flex items-center justify-center hover:bg-[#2563EB] transition-colors duration-500">+</button>
                </div>
              </div>

              <div className="space-y-6">
                {lessonsToAdd.map((lesson, lIndex) => (
                  <div key={lIndex} className="bg-white dark:bg-[#1E293B]/20 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 transition-colors duration-500 shadow-sm">

                    {/* Module Header Input */}
                    <div className="flex gap-4 items-start mb-6 pb-6 border-b border-slate-200 dark:border-slate-800">
                      <div className="w-10 h-10 shrink-0 flex items-center justify-center font-black text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-[#0F172A] rounded-full shadow-inner border border-slate-100 dark:border-slate-700 transition-colors duration-500">{lIndex + 1}</div>
                      <div className="flex-1 grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2 mb-1.5 block">Module Code</label>
                          <input type="text" placeholder="e.g. Lesson 1" value={lesson.lesson} onChange={(e) => handleAddLessonFieldChange(lIndex, 'lesson', e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-500" />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2 mb-1.5 block">Module Title</label>
                          <input type="text" placeholder="e.g. Basic Wiring" value={lesson.title} onChange={(e) => handleAddLessonFieldChange(lIndex, 'title', e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-500" />
                        </div>
                      </div>
                    </div>

                    <div className="pl-14 space-y-8">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3">Attached Materials</label>
                        <div className="space-y-3">
                          {lesson.contents.map((content, cIndex) => {
                            const dragId = `add-${lIndex}-${cIndex}`;
                            return (
                              <div key={cIndex} className="p-4 bg-slate-50/50 dark:bg-[#0B1120]/30 rounded-2xl border border-slate-200 dark:border-slate-700/60 flex flex-col gap-3 relative group transition-colors">

                                <div className="flex gap-3 items-center">
                                  <input
                                    type="text"
                                    placeholder="Material Title (e.g. Introduction Handout)"
                                    value={content.name}
                                    onChange={(e) => handleAddContentFieldChange(lIndex, cIndex, 'name', e.target.value)}
                                    className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-500 placeholder:text-slate-400"
                                  />
                                  {lesson.contents.length > 1 && (
                                    <button
                                      onClick={() => removeContentFromAddLesson(lIndex, cIndex)}
                                      className="w-9 h-9 shrink-0 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-500 flex items-center justify-center transition-colors"
                                      title="Remove Material"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                </div>

                                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center">
                                  <div className="w-full sm:w-[150px] flex p-1 bg-slate-200/60 dark:bg-[#0F172A] rounded-xl border border-slate-200 dark:border-slate-700 h-[42px] shrink-0">
                                    <button
                                      className={`flex-1 flex justify-center items-center gap-1.5 text-xs font-bold rounded-lg transition-all ${!content.isLink ? 'bg-white dark:bg-[#1E293B] text-[#0B1B3D] dark:text-slate-200 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                      onClick={() => handleAddContentFieldChange(lIndex, cIndex, 'isLink', false)}
                                    >
                                      <FileText size={14} /> File
                                    </button>
                                    <button
                                      className={`flex-1 flex justify-center items-center gap-1.5 text-xs font-bold rounded-lg transition-all ${content.isLink ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                      onClick={() => handleAddContentFieldChange(lIndex, cIndex, 'isLink', true)}
                                    >
                                      <LinkIcon size={14} /> URL
                                    </button>
                                  </div>

                                  <div className="flex-1 relative w-full">
                                    {content.isLink ? (
                                      <input
                                        type="url"
                                        placeholder="Paste YouTube link..."
                                        value={content.fileName}
                                        onChange={(e) => handleAddContentFieldChange(lIndex, cIndex, 'fileName', e.target.value)}
                                        className="w-full px-4 py-2.5 h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-red-600 dark:text-red-400 text-sm font-medium outline-none focus:ring-2 focus:ring-red-400 transition-colors duration-500 placeholder:text-slate-400"
                                      />
                                    ) : (
                                      <>
                                        <input
                                          type="file"
                                          id={`file-${dragId}`}
                                          className="hidden"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              handleAddContentFieldChange(lIndex, cIndex, 'fileName', file.name);
                                              if (!content.name) handleAddContentFieldChange(lIndex, cIndex, 'name', file.name.split('.').slice(0, -1).join('.'));
                                            }
                                          }}
                                        />
                                        <label
                                          htmlFor={`file-${dragId}`}
                                          onDragEnter={(e) => { e.preventDefault(); setActiveAddDragId(dragId); }}
                                          onDragOver={(e) => { e.preventDefault(); setActiveAddDragId(dragId); }}
                                          onDragLeave={(e) => { e.preventDefault(); setActiveAddDragId(null); }}
                                          onDrop={(e) => handleDropAdd(e, lIndex, cIndex)}
                                          className={`w-full h-[42px] px-4 rounded-xl border border-dashed text-sm font-medium transition-all duration-300 flex items-center justify-between cursor-pointer bg-white dark:bg-[#0F172A] group ${activeAddDragId === dragId
                                            ? 'border-[#3B82F6] bg-blue-100 dark:bg-[#3B82F6]/30 scale-[1.01] shadow-md text-[#3B82F6] dark:text-[#60A5FA]'
                                            : content.fileName
                                              ? 'border-[#3B82F6] text-[#3B82F6] dark:text-[#60A5FA]'
                                              : 'border-slate-300 dark:border-slate-600 text-slate-400 hover:border-[#3B82F6] dark:hover:border-[#3B82F6]'
                                            }`}
                                        >
                                          <span className="truncate pr-2 pointer-events-none transition-colors">
                                            {activeAddDragId === dragId ? "Drop it here!" : (content.fileName || "Click or Drag file...")}
                                          </span>
                                          <Upload size={16} className={`shrink-0 pointer-events-none transition-all duration-300 ${activeAddDragId === dragId ? 'animate-bounce' : 'group-hover:text-[#3B82F6] dark:group-hover:text-[#60A5FA]'}`} />
                                        </label>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => addNewContentToAddLesson(lIndex)}
                          className="text-xs font-bold text-[#3B82F6] flex items-center gap-1.5 mt-3 hover:bg-blue-50 dark:hover:bg-[#3B82F6]/10 px-4 py-2 rounded-xl transition-colors"
                        >
                          <Plus size={14} /> Add another material
                        </button>
                      </div>

                      <div className="pt-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3">Assigned Simulations</label>

                        {(() => {
                          const availableSims = getAvailableSimsForAdd(lIndex);

                          if (availableSims.length === 0 && lesson.selectedSimulations.length === 0) {
                            return (
                              <div className="bg-slate-50 dark:bg-[#0B1120]/30 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700/50">
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">All available simulations have been assigned.</p>
                              </div>
                            );
                          }

                          return (
                            <div className="flex flex-wrap gap-2 sm:gap-2.5">
                              {availableSims.map(sim => {
                                const isSelected = lesson.selectedSimulations.includes(sim.id);
                                return (
                                  <button
                                    key={sim.id}
                                    onClick={() => handleAddSimulationToggle(lIndex, sim.id)}
                                    className={`px-3 py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all duration-300 flex items-center gap-1.5 sm:gap-2 border ${isSelected
                                        ? 'bg-[#3B82F6] text-white border-[#3B82F6] shadow-md shadow-blue-500/30 scale-[1.02]'
                                        : 'bg-white dark:bg-[#0F172A] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-[#3B82F6]/50 hover:bg-blue-50/50 dark:hover:bg-[#3B82F6]/10'
                                      }`}
                                  >
                                    {isSelected ? <Check size={14} className="text-white" /> : <Gamepad2 size={14} className="opacity-70" />}
                                    {sim.name}
                                  </button>
                                )
                              })}
                            </div>
                          )
                        })()}
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20 shrink-0 flex justify-end gap-3 transition-colors duration-500">
              <button onClick={handleCloseAddModal} className="px-5 sm:px-6 py-2.5 rounded-full text-sm font-bold text-slate-500 hover:text-[#0B1B3D] dark:hover:text-slate-200 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 transition-colors duration-500 shadow-sm">Cancel</button>
              <button onClick={handleSaveAdd} className="px-6 sm:px-8 py-2.5 rounded-full text-sm font-bold text-white bg-[#3B82F6] hover:bg-[#2563EB] shadow-lg shadow-blue-500/20 transition-all hover:scale-105">Save Modules</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* SECTION: EDIT SINGLE LESSON MODAL OVERLAY */}
      {/* ========================================= */}
      {isEditModalOpen && lessonsToEdit.length > 0 && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className={`absolute inset-0 bg-[#0B1B3D]/40 dark:bg-[#0F172A]/80 backdrop-blur-sm transition-opacity duration-300 ease-out ${isEditModalVisible ? 'opacity-100' : 'opacity-0'}`} onClick={handleCloseEditModal} />

          <div className={`relative w-full max-w-3xl h-[650px] max-h-[90vh] bg-white dark:bg-[#1E293B] rounded-3xl shadow-2xl flex flex-col overflow-hidden transform transition-all duration-300 ease-out ${isEditModalVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
            <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20 shrink-0 transition-colors duration-500">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-colors duration-500"><Settings2 size={24} /></div>
                <div>
                  <h2 className="text-xl font-extrabold text-[#0B1B3D] dark:text-slate-100 transition-colors duration-500">Edit Module</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-medium transition-colors duration-500">Update module details, attached materials, and assigned simulations.</p>
                </div>
              </div>
              <button onClick={handleCloseEditModal} className="text-slate-400 hover:text-[#0B1B3D] dark:hover:text-slate-200 transition-colors bg-white dark:bg-[#0F172A] p-2 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm"><X size={20} /></button>
            </div>

            <div className="p-8 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 transition-colors duration-500">

              {(() => {
                const lesson = lessonsToEdit[0];
                return (
                  <div className="space-y-8">
                    {/* Module Header Input */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2 mb-1.5 block">Module Code</label>
                        <input type="text" placeholder="e.g. Lesson 1" value={lesson.lesson} onChange={(e) => handleEditLessonFieldChange('lesson', e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-500" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-2 mb-1.5 block">Module Title</label>
                        <input type="text" placeholder="e.g. Basic Wiring" value={lesson.title} onChange={(e) => handleEditLessonFieldChange('title', e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 text-sm font-bold outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-500" />
                      </div>
                    </div>

                    {/* Specifically Named Materials List */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">Attached Materials</label>

                      <div className="space-y-3">
                        {lesson.contents.map((content, cIndex) => {
                          const dragId = `edit-${lesson.id}-${cIndex}`;
                          return (
                            <div key={cIndex} className="p-4 bg-slate-50/50 dark:bg-[#0B1120]/30 rounded-2xl border border-slate-200 dark:border-slate-700/60 flex flex-col gap-3 relative group transition-colors">

                              <div className="flex gap-3 items-center">
                                <input
                                  type="text"
                                  placeholder="Material Title (e.g. Introduction Handout)"
                                  value={content.name}
                                  onChange={(e) => handleEditContentFieldChange(cIndex, 'name', e.target.value)}
                                  className="flex-1 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 text-sm font-semibold outline-none focus:ring-2 focus:ring-[#3B82F6] transition-colors duration-500 placeholder:text-slate-400"
                                />
                                {lesson.contents.length > 1 && (
                                  <button
                                    onClick={() => removeContentFromEditLesson(cIndex)}
                                    className="w-9 h-9 shrink-0 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-500 flex items-center justify-center transition-colors"
                                    title="Remove Material"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </div>

                              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 items-stretch sm:items-center">
                                <div className="w-full sm:w-[150px] flex p-1 bg-slate-200/60 dark:bg-[#0F172A] rounded-xl border border-slate-200 dark:border-slate-700 h-[42px] shrink-0">
                                  <button
                                    className={`flex-1 flex justify-center items-center gap-1.5 text-xs font-bold rounded-lg transition-all ${!content.isLink ? 'bg-white dark:bg-[#1E293B] text-[#0B1B3D] dark:text-slate-200 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                    onClick={() => handleEditContentFieldChange(cIndex, 'isLink', false)}
                                  >
                                    <FileText size={14} /> File
                                  </button>
                                  <button
                                    className={`flex-1 flex justify-center items-center gap-1.5 text-xs font-bold rounded-lg transition-all ${content.isLink ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                    onClick={() => handleEditContentFieldChange(cIndex, 'isLink', true)}
                                  >
                                    <LinkIcon size={14} /> URL
                                  </button>
                                </div>

                                <div className="flex-1 relative w-full">
                                  {content.isLink ? (
                                    <input
                                      type="url"
                                      placeholder="Paste YouTube link..."
                                      value={content.fileName}
                                      onChange={(e) => handleEditContentFieldChange(cIndex, 'fileName', e.target.value)}
                                      className="w-full px-4 py-2.5 h-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-red-600 dark:text-red-400 text-sm font-medium outline-none focus:ring-2 focus:ring-red-400 transition-colors duration-500 placeholder:text-slate-400"
                                    />
                                  ) : (
                                    <>
                                      <input
                                        type="file"
                                        id={`file-${dragId}`}
                                        className="hidden"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            handleEditContentFieldChange(cIndex, 'fileName', file.name);
                                            if (!content.name) handleEditContentFieldChange(cIndex, 'name', file.name.split('.').slice(0, -1).join('.'));
                                          }
                                        }}
                                      />
                                      <label
                                        htmlFor={`file-${dragId}`}
                                        onDragEnter={(e) => { e.preventDefault(); setActiveEditDragId(dragId); }}
                                        onDragOver={(e) => { e.preventDefault(); setActiveEditDragId(dragId); }}
                                        onDragLeave={(e) => { e.preventDefault(); setActiveEditDragId(null); }}
                                        onDrop={(e) => handleDropEdit(e, cIndex)}
                                        className={`w-full h-[42px] px-4 rounded-xl border border-dashed text-sm font-medium transition-all duration-300 flex items-center justify-between cursor-pointer bg-white dark:bg-[#0F172A] group ${activeEditDragId === dragId
                                          ? 'border-[#3B82F6] bg-blue-100 dark:bg-[#3B82F6]/30 scale-[1.01] shadow-md text-[#3B82F6] dark:text-[#60A5FA]'
                                          : content.fileName
                                            ? 'border-[#3B82F6] text-[#3B82F6] dark:text-[#60A5FA]'
                                            : 'border-slate-300 dark:border-slate-600 text-slate-400 hover:border-[#3B82F6] dark:hover:border-[#3B82F6]'
                                          }`}
                                      >
                                        <span className="truncate pr-2 pointer-events-none transition-colors text-xs sm:text-sm">
                                          {activeEditDragId === dragId ? "Drop it here!" : (content.fileName || "Click or Drag file...")}
                                        </span>
                                        <Upload size={16} className={`shrink-0 pointer-events-none transition-all duration-300 ${activeEditDragId === dragId ? 'animate-bounce' : 'group-hover:text-[#3B82F6] dark:group-hover:text-[#60A5FA]'}`} />
                                      </label>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => addNewContentToEditLesson()}
                        className="text-xs font-bold text-[#3B82F6] flex items-center gap-1.5 mt-3 hover:bg-blue-50 dark:hover:bg-[#3B82F6]/10 px-4 py-2 rounded-xl transition-colors"
                      >
                        <Plus size={14} /> Add another material
                      </button>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">Assigned Simulations</label>

                      {(() => {
                        const availableSims = getAvailableSimsForEdit(lesson.id!);

                        if (availableSims.length === 0 && lesson.selectedSimulations.length === 0) {
                          return (
                            <div className="bg-slate-50 dark:bg-[#0B1120]/30 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700/50">
                              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">All available simulations have been assigned to other modules.</p>
                            </div>
                          );
                        }

                        return (
                          <div className="flex flex-wrap gap-2 sm:gap-2.5">
                            {availableSims.map(sim => {
                              const isSelected = lesson.selectedSimulations.includes(sim.id);
                              return (
                                <button
                                  key={sim.id}
                                  onClick={() => handleEditSimulationToggle(sim.id)}
                                  className={`px-3 py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all duration-300 flex items-center gap-1.5 sm:gap-2 border ${isSelected
                                      ? 'bg-[#3B82F6] text-white border-[#3B82F6] shadow-md shadow-blue-500/30 scale-[1.02]'
                                      : 'bg-slate-50 dark:bg-[#0F172A] text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-[#3B82F6]/50 hover:bg-blue-50/50 dark:hover:bg-[#3B82F6]/10'
                                    }`}
                                >
                                  {isSelected ? <Check size={14} className="text-white" /> : <Gamepad2 size={14} className="opacity-70" />}
                                  {sim.name}
                                </button>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </div>

                  </div>
                );
              })()}

            </div>

            <div className="p-6 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20 shrink-0 flex justify-end gap-3 transition-colors duration-500">
              <button onClick={handleCloseEditModal} className="px-5 sm:px-6 py-2.5 rounded-full text-sm font-bold text-slate-500 hover:text-[#0B1B3D] dark:hover:text-slate-200 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 transition-colors duration-500 shadow-sm">Cancel</button>
              <button onClick={handleSaveEdit} className="px-6 sm:px-8 py-2.5 rounded-full text-sm font-bold text-white bg-[#1E293B] dark:bg-slate-600 hover:bg-[#0F172A] dark:hover:bg-slate-500 shadow-lg transition-all hover:scale-105">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================= */}
      {/* SECTION: DELETE CONFIRMATION MODAL        */}
      {/* ========================================= */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className={`absolute inset-0 bg-[#0B1B3D]/40 dark:bg-[#0F172A]/80 backdrop-blur-sm transition-opacity duration-300 ease-out ${isDeleteModalVisible ? 'opacity-100' : 'opacity-0'}`} onClick={handleCloseDeleteModal} />

          <div className={`relative w-full max-w-md bg-white dark:bg-[#1E293B] rounded-3xl shadow-2xl flex flex-col overflow-hidden transform transition-all duration-300 ease-out ${isDeleteModalVisible ? 'scale-100 opacity-100' : 'scale-95 opacity-0'}`}>
            <div className="p-6 sm:p-8 flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-6">
                <AlertTriangle size={32} className="text-red-500" />
              </div>
              <h2 className="text-xl font-extrabold text-[#0B1B3D] dark:text-slate-100 mb-2">Delete Module?</h2>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-8">
                Are you sure you want to delete <strong className="text-[#0B1B3D] dark:text-slate-200">{activeLesson?.lesson} - {activeLesson?.title}</strong>? This action will remove all attached materials and cannot be undone.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button onClick={handleCloseDeleteModal} className="flex-1 py-3 rounded-xl text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors">
                  Cancel
                </button>
                <button onClick={handleConfirmDelete} className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/30 transition-all hover:scale-[1.02]">
                  Delete Module
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}