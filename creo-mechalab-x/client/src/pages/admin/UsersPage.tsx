import { Search, Plus, Upload, Pencil, Power } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { listAdminTrainees, setAdminTraineeStatus } from "../../api/adminTrainees";
import { ApiError } from "../../api/http";
import TraineeFormModal from "../../components/admin/TraineeFormModal";
import type { AdminTraineeItem, BatchFilter } from "../../types/adminTrainee";

type StatusFilter = "all" | "active" | "inactive";
type PillStatus = "Passed" | "Active" | "Inactive";

const statusPillClass = (status: PillStatus): string => {
  if (status === "Passed") return "bg-emerald-500 text-white";
  if (status === "Active") return "bg-[#151F8C] text-white";
  return "bg-[#EC5151] text-white";
};

const toDisplayName = (item: AdminTraineeItem): string => {
  const middle = item.middle_name ? ` ${item.middle_name}` : "";
  return `${item.first_name}${middle} ${item.last_name}`.replace(/\s+/g, " ").trim();
};

const toInitials = (name: string): string => {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return "Failed to load trainee list.";
};

export default function UsersPage() {
  const [items, setItems] = useState<AdminTraineeItem[]>([]);
  const [batches, setBatches] = useState<BatchFilter[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedBatch, setSelectedBatch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selectedItem, setSelectedItem] = useState<AdminTraineeItem | null>(null);
  const [statusActionId, setStatusActionId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await listAdminTrainees({
          search: debouncedSearch || undefined,
          batch: selectedBatch || undefined,
          status: statusFilter,
          limit: 25,
          offset: 0,
        });

        if (!active) return;
        setItems(response.items);
        setBatches(response.filters.batches);
      } catch (loadError) {
        if (!active) return;
        setItems([]);
        setError(toErrorMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [debouncedSearch, selectedBatch, statusFilter, refreshKey]);

  const rows = useMemo(() => {
    return items.map((item) => {
      const displayStatus: PillStatus =
        item.progress.percent === 100 ? "Passed" : item.status === "active" ? "Active" : "Inactive";
      const fullName = toDisplayName(item);
      const id = String(item.trainee_id);

      return {
        id,
        raw: item,
        displayStatus,
        fullName,
        initials: toInitials(fullName),
      };
    });
  }, [items]);

  const openCreateModal = () => {
    setSelectedItem(null);
    setModalMode("create");
    setModalOpen(true);
  };

  const openEditModal = (item: AdminTraineeItem) => {
    setSelectedItem(item);
    setModalMode("edit");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const handleSaved = () => {
    setModalOpen(false);
    setSelectedItem(null);
    setRefreshKey((prev) => prev + 1);
  };

  const handleToggleStatus = async (item: AdminTraineeItem) => {
    const traineeId = String(item.trainee_id);
    const nextStatus = item.status === "active" ? "inactive" : "active";

    setStatusActionId(traineeId);
    setError(null);

    try {
      const result = await setAdminTraineeStatus(traineeId, nextStatus);
      const updatedId = String(result.item.trainee_id);
      setItems((prev) => prev.map((current) => (String(current.trainee_id) === updatedId ? result.item : current)));
    } catch (statusError) {
      setError(toErrorMessage(statusError));
    } finally {
      setStatusActionId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg p-4 border border-black/10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search trainees..."
              className="pl-10 pr-4 py-2 rounded-md border border-slate-400 w-[260px] outline-none focus:ring-2 focus:ring-slate-300"
            />
          </div>

          <select
            value={selectedBatch}
            onChange={(event) => setSelectedBatch(event.target.value)}
            className="py-2 px-3 rounded-md border border-slate-400 w-[180px] outline-none focus:ring-2 focus:ring-slate-300 font-semibold"
          >
            <option value="">All Batches</option>
            {batches.map((batch) => (
              <option key={batch.batch_id} value={batch.batch_code}>
                {batch.batch_code}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="py-2 px-3 rounded-md border border-slate-400 w-[180px] outline-none focus:ring-2 focus:ring-slate-300 font-semibold"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openCreateModal}
            className="bg-[#2E415F] text-white px-6 py-2 rounded-lg font-semibold flex items-center gap-2"
          >
            <Plus size={18} aria-hidden="true" /> Add User
          </button>
          <button
            type="button"
            disabled
            className="bg-white border border-slate-300 text-slate-500 px-6 py-2 rounded-lg font-semibold flex items-center gap-2 cursor-not-allowed"
          >
            <Upload size={18} aria-hidden="true" /> Import CSV (Phase 2)
          </button>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      <div className="bg-white rounded-lg border border-black/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white">
            <tr className="text-xs font-extrabold text-slate-700 border-b border-black/20">
              <th className="px-6 py-4 text-left">NAME</th>
              <th className="px-4 py-4 text-left">STUDENT ID</th>
              <th className="px-4 py-4 text-left">EMAIL ADDRESS</th>
              <th className="px-4 py-4 text-left">BATCH</th>
              <th className="px-4 py-4 text-left">PROGRESS</th>
              <th className="px-4 py-4 text-left">STATUS</th>
              <th className="px-6 py-4 text-left">ACTIONS</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-black/10">
            {rows.map((row) => {
              const actionLabel = row.raw.status === "active" ? "Deactivate" : "Reactivate";
              const actionClass =
                row.raw.status === "active"
                  ? "bg-[#EC5151] hover:bg-[#d94545]"
                  : "bg-emerald-600 hover:bg-emerald-700";
              const isToggling = statusActionId === row.id;

              return (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-slate-200 border border-slate-300 grid place-items-center text-slate-600">
                        {row.initials}
                      </div>
                      <div className="leading-tight">
                        <div className="font-semibold">{row.fullName}</div>
                        <div className="text-xs text-slate-400">{row.raw.trainee_code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">{row.raw.trainee_code}</td>
                  <td className="px-4 py-4">{row.raw.email}</td>
                  <td className="px-4 py-4">{row.raw.batch.batch_code}</td>
                  <td className="px-4 py-4">
                    <div className="w-[220px]">
                      <div className="flex justify-between text-xs text-slate-700 font-semibold">
                        <span>{row.raw.progress.label}</span>
                      </div>
                      <div className="mt-2 h-1 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-[#18B9C7]" style={{ width: `${row.raw.progress.percent}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center justify-center px-5 py-1.5 rounded-full text-xs font-bold ${statusPillClass(
                        row.displayStatus
                      )}`}
                    >
                      {row.displayStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openEditModal(row.raw)}
                        className="bg-slate-500 hover:bg-slate-600 text-white px-5 py-1.5 rounded-md font-semibold flex items-center gap-2"
                      >
                        <Pencil size={16} aria-hidden="true" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleToggleStatus(row.raw);
                        }}
                        className={`${actionClass} text-white px-5 py-1.5 rounded-md font-semibold flex items-center gap-2 disabled:opacity-60`}
                        disabled={isToggling}
                      >
                        <Power size={16} aria-hidden="true" />
                        {isToggling ? "Saving..." : actionLabel}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                  No users found.
                </td>
              </tr>
            )}

            {loading && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                  Loading trainees...
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TraineeFormModal
        open={modalOpen}
        mode={modalMode}
        initial={selectedItem}
        batches={batches}
        onClose={closeModal}
        onSaved={handleSaved}
      />
    </div>
  );
}

