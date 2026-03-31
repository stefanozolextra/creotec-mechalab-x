import React, { useState, useEffect } from "react";
import { X, Upload, Link as LinkIcon, Loader2, FileText, PlayCircle, Trash2, Layers3 } from "lucide-react";
import { requestJson } from "../../api/http";
import { motion } from "framer-motion";

interface ResourceInput {
    id: string;
    type: "PDF" | "VIDEO";
    title: string;
    file: File | null;
    url: string;
}

interface SimulationOption {
    simulation_id: number;
    simulation_code: string;
    title: string;
}

interface CreateModuleModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateModuleModal({ onClose, onSuccess }: CreateModuleModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    const [moduleCode, setModuleCode] = useState("");
    const [moduleTitle, setModuleTitle] = useState("");
    const [moduleDesc, setModuleDesc] = useState("");

    const [resources, setResources] = useState<ResourceInput[]>([]);
    
    // Multi-Simulation state
    const [availableSimulations, setAvailableSimulations] = useState<SimulationOption[]>([]);
    const [selectedSimulationIds, setSelectedSimulationIds] = useState<number[]>([]);

    useEffect(() => {
        const fetchSimulations = async () => {
            try {
                const data = await requestJson<{ simulations: SimulationOption[] }>("/api/admin/simulations");
                setAvailableSimulations(data.simulations || []);
            } catch (err) {
                console.error("Failed to fetch simulations:", err);
            }
        };
        fetchSimulations();
    }, []);

    const addResourceField = (type: "PDF" | "VIDEO") => {
        setResources([
            ...resources,
            { id: Math.random().toString(36).substring(7), type, title: "", file: null, url: "" },
        ]);
    };

    const removeResource = (id: string) => {
        setResources(resources.filter((r) => r.id !== id));
    };

    const updateResource = (id: string, field: keyof ResourceInput, value: string | File | null) => {
        setResources(resources.map((r) => r.id === id ? { ...r, [field]: value } as ResourceInput : r));
    };

    const toggleSimulation = (id: number) => {
        if (selectedSimulationIds.includes(id)) {
            setSelectedSimulationIds(selectedSimulationIds.filter(simId => simId !== id));
        } else {
            setSelectedSimulationIds([...selectedSimulationIds, id]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!moduleCode.trim() || !moduleTitle.trim()) return setError("Module Code and Title are required.");
        for (const res of resources) {
            if (!res.title.trim()) return setError("All learning materials must have a title.");
            if (res.type === "PDF" && !res.file) return setError(`Missing file for PDF: ${res.title}`);
            if (res.type === "VIDEO" && !res.url.trim()) return setError(`Missing URL for Video: ${res.title}`);
        }

        setIsLoading(true);

        try {
            // 1. Create the Module shell
            const moduleRes = await requestJson<{ module: { module_id: number } }>("/api/admin/lessons/modules", {
                method: "POST",
                body: { moduleCode: moduleCode.trim(), title: moduleTitle.trim(), description: moduleDesc.trim() }
            });
            
            const newModuleId = moduleRes.module.module_id;

            // 2. Attach ALL selected simulations
            if (selectedSimulationIds.length > 0) {
                 await requestJson(`/api/admin/modules/${newModuleId}/simulations`, {
                     method: "PUT",
                     body: { simulationIds: selectedSimulationIds }
                 }).catch(err => console.warn("Failed to assign simulations:", err));
            }

            // 3. Upload/Attach all resources
            for (const res of resources) {
                if (res.type === "VIDEO") {
                    await requestJson(`/api/admin/modules/${newModuleId}/lessons`, {
                        method: "POST",
                        body: { title: res.title.trim(), type: "VIDEO", url: res.url.trim(), video_url: res.url.trim() }
                    });
                } else if (res.type === "PDF" && res.file) {
                    const lessonRes = await requestJson<{ lesson: { resource_id: number } }>(`/api/admin/modules/${newModuleId}/lessons`, {
                        method: "POST",
                        body: { title: res.title.trim(), type: "PDF" }
                    });
                    
                    const formData = new FormData();
                    formData.append("file", res.file);
                    
                    await requestJson(`/api/admin/modules/${newModuleId}/lessons/${lessonRes.lesson.resource_id}/pdf`, {
                        method: "POST",
                        body: formData
                    });
                }
            }

            onSuccess();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "An unexpected error occurred while saving the module.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ duration: 0.2, ease: "easeOut" }} className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800/50 w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
                <div className="flex justify-between items-center p-6 border-b border-slate-100 dark:border-slate-800/50 bg-white dark:bg-[#1E293B]">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-[#3B82F6]">
                            <Layers3 size={20} />
                        </div>
                        <h2 className="text-xl font-black text-slate-800 dark:text-white tracking-tight">Create New Module</h2>
                    </div>
                    <button type="button" onClick={onClose} disabled={isLoading} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"><X className="w-5 h-5" /></button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    <form id="create-module-form" onSubmit={handleSubmit} className="space-y-8">
                        {error && <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm font-semibold flex items-center gap-2">{error}</div>}

                        {/* Module Details */}
                        <div className="space-y-4">
                            <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">1. Module Details</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Module Code</label>
                                    <input type="text" placeholder="e.g. M01" value={moduleCode} onChange={(e) => setModuleCode(e.target.value)} disabled={isLoading} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-slate-800 dark:text-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-[#3B82F6] transition-all disabled:opacity-60" required />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Module Title</label>
                                    <input type="text" placeholder="e.g. Intro to Mechatronics" value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} disabled={isLoading} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-slate-800 dark:text-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-[#3B82F6] transition-all disabled:opacity-60" required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Description (Optional)</label>
                                <textarea rows={2} value={moduleDesc} onChange={(e) => setModuleDesc(e.target.value)} disabled={isLoading} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-slate-800 dark:text-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-[#3B82F6] transition-all disabled:opacity-60" />
                            </div>
                        </div>

                        {/* Multi-Select Simulation Section */}
                        <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800/50">
                             <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">2. Simulation Activities</h3>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Select Required Simulations (Optional)</label>
                                {availableSimulations.length === 0 ? (
                                    <p className="text-[11px] font-semibold text-amber-500 mt-1">No simulations available in the system.</p>
                                ) : (
                                    <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar p-3 bg-slate-50 dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded-xl">
                                        {availableSimulations.map(sim => (
                                            <label key={sim.simulation_id} className="flex items-center gap-3 p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors">
                                                <input type="checkbox" checked={selectedSimulationIds.includes(sim.simulation_id)} onChange={() => toggleSimulation(sim.simulation_id)} disabled={isLoading} className="w-4 h-4 text-[#3B82F6] rounded border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:ring-[#3B82F6]" />
                                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{sim.simulation_code} - {sim.title}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Materials Section */}
                        <div className="space-y-4 pt-6 border-t border-slate-100 dark:border-slate-800/50">
                            <div className="flex justify-between items-center">
                                <h3 className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">3. Learning Materials</h3>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => addResourceField("PDF")} disabled={isLoading} className="flex items-center gap-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"><FileText className="w-4 h-4 text-[#3B82F6]" /> Add PDF</button>
                                    <button type="button" onClick={() => addResourceField("VIDEO")} disabled={isLoading} className="flex items-center gap-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 px-3 py-2 rounded-xl transition-colors disabled:opacity-50"><PlayCircle className="w-4 h-4 text-emerald-500" /> Add Video</button>
                                </div>
                            </div>
                            {resources.length === 0 ? (
                                <div className="text-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-700/50 rounded-2xl text-slate-500 font-semibold text-sm bg-slate-50/50 dark:bg-[#1E293B]/50">No materials added yet. Click the buttons above to attach PDFs or Videos.</div>
                            ) : (
                                <div className="space-y-3">
                                    {resources.map((res, index) => (
                                        <div key={res.id} className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 p-4 rounded-2xl flex gap-4 items-start relative group transition-all hover:border-[#3B82F6]/50">
                                            <div className="mt-2 w-8 h-8 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shrink-0 shadow-sm border border-slate-100 dark:border-slate-700/50">
                                                {res.type === "PDF" ? <FileText className="w-4 h-4 text-[#3B82F6]" /> : <PlayCircle className="w-4 h-4 text-emerald-500" />}
                                            </div>
                                            <div className="flex-1 space-y-3 min-w-0">
                                                <input type="text" placeholder={`${res.type} Title (e.g. Lesson ${index + 1} Manual)`} value={res.title} onChange={(e) => updateResource(res.id, "title", e.target.value)} disabled={isLoading} className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#3B82F6] transition-all disabled:opacity-60" required />
                                                {res.type === "VIDEO" ? (
                                                    <div className="flex items-center gap-2 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-700 rounded-lg px-3 overflow-hidden focus-within:ring-2 focus-within:ring-[#3B82F6] transition-all">
                                                        <LinkIcon className="w-4 h-4 text-slate-400" />
                                                        <input type="url" placeholder="https://youtube.com/..." value={res.url} onChange={(e) => updateResource(res.id, "url", e.target.value)} disabled={isLoading} className="w-full bg-transparent py-2 text-sm font-medium text-slate-800 dark:text-slate-200 outline-none disabled:opacity-60" required />
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <input type="file" accept=".pdf" onChange={(e) => updateResource(res.id, "file", e.target.files?.[0] || null)} disabled={isLoading} className="text-sm font-semibold text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-[#3B82F6]/10 file:text-[#3B82F6] hover:file:bg-[#3B82F6]/20 file:transition-colors file:cursor-pointer disabled:opacity-60" required />
                                                    </div>
                                                )}
                                            </div>
                                            <button type="button" onClick={() => removeResource(res.id)} disabled={isLoading} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors disabled:opacity-30"><Trash2 className="w-4 h-4" /></button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </form>
                </div>
                <div className="p-6 border-t border-slate-100 dark:border-slate-800/50 flex justify-end gap-3 bg-slate-50 dark:bg-[#1E293B]">
                    <button type="button" onClick={onClose} disabled={isLoading} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50">Cancel</button>
                    <button type="submit" form="create-module-form" disabled={isLoading} className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold bg-[#3B82F6] hover:bg-blue-600 text-white rounded-xl transition-all shadow-sm disabled:opacity-50">
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {isLoading ? "Processing..." : "Save Complete Module"}
                    </button>
                </div>
            </motion.div>
        </motion.div>
    );
}