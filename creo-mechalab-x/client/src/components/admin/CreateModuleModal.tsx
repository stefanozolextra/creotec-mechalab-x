import React, { useState } from "react";
import { X, Upload, Link as LinkIcon, Loader2, FileText, PlayCircle, Trash2 } from "lucide-react";
import { requestJson } from "../../api/http"; // <-- Corrected import

interface ResourceInput {
    id: string;
    type: "PDF" | "VIDEO";
    title: string;
    file: File | null;
    url: string;
}

interface CreateModuleModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateModuleModal({ onClose, onSuccess }: CreateModuleModalProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    // Module Details
    const [moduleCode, setModuleCode] = useState("");
    const [moduleTitle, setModuleTitle] = useState("");
    const [moduleDesc, setModuleDesc] = useState("");

    // Dynamic Resources List
    const [resources, setResources] = useState<ResourceInput[]>([]);

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
        setResources(resources.map((r) => {
            if (r.id === id) {
                return { ...r, [field]: value } as ResourceInput;
            }
            return r;
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        // Validation
        if (!moduleCode.trim() || !moduleTitle.trim()) {
            return setError("Module Code and Title are required.");
        }
        for (const res of resources) {
            if (!res.title.trim()) return setError("All learning materials must have a title.");
            if (res.type === "PDF" && !res.file) return setError(`Missing file for PDF: ${res.title}`);
            if (res.type === "VIDEO" && !res.url.trim()) return setError(`Missing URL for Video: ${res.title}`);
        }

        setIsLoading(true);

        try {
            // 1. Create the Module using the requestJson wrapper
            const moduleRes = await requestJson<{ module: { module_id: number } }>("/admin/lessons/modules", {
                method: "POST",
                body: {
                    moduleCode: moduleCode.trim(),
                    title: moduleTitle.trim(),
                    description: moduleDesc.trim(),
                }
            });
            
            const newModuleId = moduleRes.module.module_id;

            // 2. Upload/Attach all resources sequentially
            for (let i = 0; i < resources.length; i++) {
                const res = resources[i];
                
                if (res.type === "VIDEO") {
                    // Attach Video URL
                    await requestJson(`/admin/lessons/modules/${newModuleId}/resources`, {
                        method: "POST",
                        body: {
                            type: "VIDEO",
                            title: res.title.trim(),
                            url: res.url.trim(),
                            orderNo: i + 1,
                        }
                    });
                } else if (res.type === "PDF" && res.file) {
                    // Upload PDF File
                    const formData = new FormData();
                    formData.append("file", res.file);
                    formData.append("title", res.title.trim());
                    formData.append("orderNo", (i + 1).toString());

                    // requestJson automatically detects FormData and drops the JSON content-type header
                    await requestJson(`/admin/lessons/modules/${newModuleId}/resources/upload`, {
                        method: "POST",
                        body: formData,
                    });
                }
            }

            // 3. Close and Refresh
            onSuccess();
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message);
            } else {
                setError("An unexpected error occurred while saving the module.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-gray-800 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-800">
                    <h2 className="text-xl font-bold text-white">Create New Module</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Scrollable Form */}
                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    <form id="create-module-form" onSubmit={handleSubmit} className="space-y-6">
                        
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        {/* Module Details */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">1. Module Details</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm text-gray-300 mb-1">Module Code</label>
                                    <input type="text" placeholder="e.g. M01" value={moduleCode} onChange={(e) => setModuleCode(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none" required />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm text-gray-300 mb-1">Module Title</label>
                                    <input type="text" placeholder="e.g. Introduction to Mechatronics" value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none" required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm text-gray-300 mb-1">Description (Optional)</label>
                                <textarea rows={2} value={moduleDesc} onChange={(e) => setModuleDesc(e.target.value)} className="w-full bg-gray-950 border border-gray-800 rounded-lg p-2.5 text-white focus:border-blue-500 outline-none" />
                            </div>
                        </div>

                        {/* Materials Section */}
                        <div className="space-y-4 pt-4 border-t border-gray-800">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">2. Learning Materials</h3>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => addResourceField("PDF")} className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg transition-colors">
                                        <FileText className="w-3.5 h-3.5" /> Add PDF
                                    </button>
                                    <button type="button" onClick={() => addResourceField("VIDEO")} className="flex items-center gap-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-white px-3 py-1.5 rounded-lg transition-colors">
                                        <PlayCircle className="w-3.5 h-3.5" /> Add Video Link
                                    </button>
                                </div>
                            </div>

                            {resources.length === 0 ? (
                                <div className="text-center p-8 border border-dashed border-gray-800 rounded-xl text-gray-500 text-sm">
                                    No materials added yet. Click the buttons above to add PDFs or Videos.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {resources.map((res, index) => (
                                        <div key={res.id} className="bg-gray-950 border border-gray-800 p-4 rounded-xl flex gap-4 items-start relative group">
                                            <div className="mt-2 text-gray-500">
                                                {res.type === "PDF" ? <FileText className="w-5 h-5 text-rose-400" /> : <PlayCircle className="w-5 h-5 text-blue-400" />}
                                            </div>
                                            
                                            <div className="flex-1 space-y-3">
                                                <input type="text" placeholder={`${res.type} Title (e.g. Lesson ${index + 1} Manual)`} value={res.title} onChange={(e) => updateResource(res.id, "title", e.target.value)} className="w-full bg-gray-900 border border-gray-800 rounded-lg p-2 text-sm text-white focus:border-blue-500 outline-none" required />
                                                
                                                {res.type === "VIDEO" ? (
                                                    <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 overflow-hidden focus-within:border-blue-500">
                                                        <LinkIcon className="w-4 h-4 text-gray-500" />
                                                        <input type="url" placeholder="https://youtube.com/..." value={res.url} onChange={(e) => updateResource(res.id, "url", e.target.value)} className="w-full bg-transparent p-2 text-sm text-blue-400 outline-none" required />
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <input type="file" accept=".pdf" onChange={(e) => updateResource(res.id, "file", e.target.files?.[0] || null)} className="text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-gray-800 file:text-white hover:file:bg-gray-700 file:cursor-pointer" required />
                                                    </div>
                                                )}
                                            </div>

                                            <button type="button" onClick={() => removeResource(res.id)} className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-md transition-colors" title="Remove material">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-800 flex justify-end gap-3 bg-gray-900/50 rounded-b-xl">
                    <button type="button" onClick={onClose} disabled={isLoading} className="px-4 py-2 text-sm font-semibold text-gray-400 hover:text-white transition-colors">
                        Cancel
                    </button>
                    <button type="submit" form="create-module-form" disabled={isLoading} className="flex items-center gap-2 px-5 py-2 text-sm font-bold bg-blue-500 hover:bg-blue-400 text-white rounded-lg transition-colors disabled:opacity-50">
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {isLoading ? "Saving & Uploading..." : "Save Complete Module"}
                    </button>
                </div>

            </div>
        </div>
    );
}