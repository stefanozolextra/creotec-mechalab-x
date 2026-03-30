import { Loader2, RotateCcw, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getAdminTraineeProgressActivityLogs } from '../../api/adminActivityLogs';
import { listAdminBatches } from '../../api/adminBatches';
import { ApiError } from '../../api/http';
import AdminTableScroll from '../../components/admin/ui/AdminTableScroll';
import type { AdminTraineeProgressLogItem } from '../../types/adminActivityLogs';
import type { AdminBatchItem } from '../../types/adminBatch';
import { formatAdminFeedTime, toAdminFeedTypeLabel } from '../../utils/adminFeed';

const DEFAULT_LIMIT = 50;

const typeChipClassByType: Record<string, string> = {
  simulation_progress:
    'bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-200/50 dark:border-sky-500/20',
  simulation_completed:
    'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-500/20',
};

const toErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Failed to load trainee progress activity.';
};

const itemKey = (item: AdminTraineeProgressLogItem): string => item.event_id;

const formatStatusLabel = (value: string | null | undefined): string => {
  if (!value) return 'Completed';
  return value.replace(/_/g, ' ').toLowerCase().replace(/^\w/, (char) => char.toUpperCase());
};

export default function ActivityLogsPage() {
  const [batchFilter, setBatchFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [appliedBatchCode, setAppliedBatchCode] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [batchOptions, setBatchOptions] = useState<AdminBatchItem[]>([]);
  const [rows, setRows] = useState<AdminTraineeProgressLogItem[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retrySeq, setRetrySeq] = useState(0);
  const [lastErrorAction, setLastErrorAction] = useState<'initial' | 'load_more' | null>(null);
  const isMountedRef = useRef(false);
  const hasLoadedBatchesRef = useRef(false);
  const loadMoreCursorRef = useRef<string | null>(null);
  const initialRequestControllerRef = useRef<AbortController | null>(null);
  const loadMoreRequestControllerRef = useRef<AbortController | null>(null);

  const appliedScopeLabel = [
    appliedBatchCode ? appliedBatchCode : 'All batches',
    appliedSearch ? `Search: ${appliedSearch}` : null,
  ]
    .filter(Boolean)
    .join(' • ');

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      initialRequestControllerRef.current?.abort();
      loadMoreRequestControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (hasLoadedBatchesRef.current) return;
    hasLoadedBatchesRef.current = true;

    const loadBatches = async () => {
      try {
        const response = await listAdminBatches();
        if (!isMountedRef.current) return;
        setBatchOptions(response.items);
        setBatchFilter((current) => (current && response.items.some((item) => item.batch_code === current) ? current : ''));
      } catch {
        if (!isMountedRef.current) return;
        setBatchOptions([]);
      }
    };

    void loadBatches();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    initialRequestControllerRef.current?.abort();
    initialRequestControllerRef.current = controller;
    loadMoreRequestControllerRef.current?.abort();
    loadMoreCursorRef.current = null;

    setLoading(true);
    setError(null);
    setLastErrorAction(null);

    const loadInitialPage = async () => {
      try {
        const response = await getAdminTraineeProgressActivityLogs({
          batchCode: appliedBatchCode || undefined,
          search: appliedSearch || undefined,
          limit: DEFAULT_LIMIT,
          signal: controller.signal,
        });
        if (!isMountedRef.current || controller.signal.aborted) return;
        setRows(response.items);
        setNextBefore(response.paging.next_before);
        setLastErrorAction(null);
      } catch (loadError) {
        if (!isMountedRef.current || controller.signal.aborted) return;
        setRows([]);
        setNextBefore(null);
        setError(toErrorMessage(loadError));
        setLastErrorAction('initial');
      } finally {
        if (isMountedRef.current && !controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void loadInitialPage();

    return () => {
      controller.abort();
    };
  }, [appliedBatchCode, appliedSearch, retrySeq]);

  const handleApply = () => {
    setAppliedBatchCode(batchFilter.trim().toUpperCase());
    setAppliedSearch(searchFilter.trim());
  };

  const handleReset = () => {
    setBatchFilter('');
    setSearchFilter('');
    setAppliedBatchCode('');
    setAppliedSearch('');
  };

  const handleLoadMore = async () => {
    if (!nextBefore || loading || loadingMore) return;
    if (loadMoreCursorRef.current === nextBefore) return;

    const cursor = nextBefore;
    loadMoreCursorRef.current = cursor;
    setLoadingMore(true);
    setError(null);
    setLastErrorAction(null);

    const controller = new AbortController();
    loadMoreRequestControllerRef.current?.abort();
    loadMoreRequestControllerRef.current = controller;

    try {
      const response = await getAdminTraineeProgressActivityLogs({
        batchCode: appliedBatchCode || undefined,
        search: appliedSearch || undefined,
        before: cursor,
        limit: DEFAULT_LIMIT,
        signal: controller.signal,
      });

      if (!isMountedRef.current || controller.signal.aborted) return;
      setRows((currentRows) => {
        const seen = new Set(currentRows.map(itemKey));
        const additions = response.items.filter((item) => {
          const key = itemKey(item);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        return additions.length === 0 ? currentRows : [...currentRows, ...additions];
      });
      setNextBefore(response.paging.next_before);
      setLastErrorAction(null);
    } catch (loadError) {
      if (!isMountedRef.current || controller.signal.aborted) return;
      loadMoreCursorRef.current = null;
      setError(toErrorMessage(loadError));
      setLastErrorAction('load_more');
    } finally {
      if (isMountedRef.current && !controller.signal.aborted) {
        setLoadingMore(false);
      }
    }
  };

  const handleRetry = () => {
    if (lastErrorAction === 'load_more' && rows.length > 0 && nextBefore && !loading && !loadingMore) {
      void handleLoadMore();
      return;
    }
    setRetrySeq((current) => current + 1);
  };

  const showEmpty = !loading && !error && rows.length === 0;
  const columnCount = 6;
  const emptyStateLabel = appliedSearch
    ? 'No trainee progress matched that search.'
    : 'No trainee simulation completions yet.';

  return (
    <div className="flex-1 flex flex-col gap-4 min-h-0 relative">
      <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-3 shadow-sm border border-slate-100 dark:border-slate-800/50 shrink-0 z-20 flex flex-col gap-3 transition-colors duration-500">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400">Activity Logs</p>
          <div className="px-4 py-2 rounded-xl bg-[#1E293B] dark:bg-slate-700 text-white text-xs sm:text-sm font-bold">
            Scope: {appliedScopeLabel}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5">
          <div className="relative z-0 w-full sm:min-w-[280px] sm:flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="search"
              value={searchFilter}
              onChange={(event) => setSearchFilter(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleApply();
              }}
              placeholder="Search trainee name, email, or trainee code"
              className="pl-9 pr-4 py-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 font-semibold text-sm outline-none focus:ring-2 focus:ring-[#3B82F6]"
            />
          </div>

          <div className="relative z-0 w-full sm:w-[220px]">
            <select
              value={batchFilter}
              onChange={(event) => setBatchFilter(event.target.value)}
              className="px-4 py-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0F172A] text-[#0B1B3D] dark:text-slate-200 font-semibold text-sm outline-none focus:ring-2 focus:ring-[#3B82F6]"
            >
              <option value="">All batches</option>
              {batchOptions.map((batch) => (
                <option key={batch.batch_id} value={batch.batch_code}>
                  {batch.batch_code}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleApply}
              className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-[#3B82F6] hover:bg-[#2563EB] shadow-md shadow-blue-500/20 transition-colors"
            >
              Apply
            </button>
            <button
              onClick={handleReset}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Reset filters"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-6 py-4 text-sm font-semibold text-red-700 shadow-sm shrink-0 flex items-center justify-between gap-3">
          <span>{error}</span>
          <button
            onClick={handleRetry}
            disabled={loading || loadingMore}
            className="px-3 py-1 rounded-lg text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-[#1E293B] rounded-3xl shadow-sm flex-1 flex flex-col min-h-0 overflow-hidden transition-colors duration-500 border border-slate-100 dark:border-slate-800/50 z-10 relative">
        <AdminTableScroll className="flex-1 min-h-0 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
          <table className="min-w-[1120px] w-full text-sm whitespace-nowrap border-collapse">
            <thead className="sticky top-0 bg-white dark:bg-[#1E293B] z-10 transition-colors duration-500 after:content-[''] after:absolute after:bottom-0 after:left-4 after:right-4 after:border-b-2 after:border-slate-100 dark:after:border-slate-700/50">
              <tr className="text-[11px] uppercase font-extrabold text-[#0B1B3D] dark:text-slate-200 tracking-wider transition-colors duration-500">
                <th className="px-8 py-5 text-left sticky left-0 z-20 bg-white dark:bg-[#1E293B]">Timestamp</th>
                <th className="px-6 py-5 text-left">Trainee</th>
                <th className="px-6 py-5 text-left">Simulation</th>
                <th className="px-6 py-5 text-left">Batch</th>
                <th className="px-6 py-5 text-left">Status</th>
                <th className="px-8 py-5 text-left">Message</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50 transition-colors duration-500">
              {loading && rows.length === 0 && (
                <tr>
                  <td colSpan={columnCount} className="px-8 py-12 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                    <span className="inline-flex items-center gap-2">
                      <Loader2 size={16} className="animate-spin" />
                      Loading trainee progress...
                    </span>
                  </td>
                </tr>
              )}

              {showEmpty && (
                <tr>
                  <td colSpan={columnCount} className="px-8 py-12 text-center text-sm font-semibold text-slate-400 dark:text-slate-500">
                    {emptyStateLabel}
                  </td>
                </tr>
              )}

              {rows.map((row) => {
                const secondaryIdentity = row.trainee_email || row.trainee_code || (row.trainee_id ? `Trainee #${row.trainee_id}` : null);
                return (
                  <tr key={row.event_id} className="group hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors duration-300">
                    <td className="px-8 py-4 text-slate-500 dark:text-slate-400 font-medium text-xs transition-colors duration-500 sticky left-0 z-[5] bg-white dark:bg-[#1E293B] group-hover:bg-slate-50 dark:group-hover:bg-white/[0.02]">
                      {formatAdminFeedTime(row.occurred_at)}
                    </td>
                    <td className="px-6 py-4 min-w-[220px]">
                      <p className="font-bold text-[#0B1B3D] dark:text-slate-100 text-xs transition-colors duration-500">
                        {row.trainee_name || row.actor || 'Trainee'}
                      </p>
                      {secondaryIdentity ? (
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{secondaryIdentity}</p>
                      ) : (
                        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">No identifier</p>
                      )}
                    </td>
                    <td className="px-6 py-4 min-w-[220px]">
                      <p className="font-bold text-[#0B1B3D] dark:text-slate-100 text-xs transition-colors duration-500">
                        {row.simulation_title || 'Simulation'}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {row.module_title || 'Module title unavailable'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {row.batch_code ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-extrabold tracking-wide uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {row.batch_code}
                        </span>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 text-xs">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 min-w-[180px]">
                      <div className="flex flex-col gap-1.5">
                        <span
                          className={`inline-flex items-center w-fit px-2.5 py-1 rounded-md text-[10px] font-black tracking-wider uppercase transition-colors duration-500 ${
                            typeChipClassByType[row.type] || typeChipClassByType.simulation_completed
                          }`}
                        >
                          {formatStatusLabel(row.status)}
                        </span>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {row.score !== null && row.score !== undefined ? `Score ${row.score}` : 'Score unavailable'}
                          {row.attempt_count !== null && row.attempt_count !== undefined ? ` • Attempt ${row.attempt_count}` : ''}
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-4 text-slate-500 dark:text-slate-400 text-xs transition-colors duration-500 whitespace-normal break-words min-w-[300px] max-w-[580px]">
                      <p>{row.message}</p>
                      <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500 uppercase tracking-[0.16em]">
                        {toAdminFeedTypeLabel(row.type)}
                      </p>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </AdminTableScroll>

        <div className="px-8 py-4 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/20 shrink-0 flex items-center justify-between transition-colors duration-500">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Showing <span className="font-bold text-[#0B1B3D] dark:text-slate-200">{rows.length}</span> entr{rows.length === 1 ? 'y' : 'ies'}
          </div>
          <button
            onClick={handleLoadMore}
            disabled={!nextBefore || loading || loadingMore}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] text-slate-600 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm text-xs font-bold inline-flex items-center gap-2"
          >
            {loadingMore && <Loader2 size={14} className="animate-spin" />}
            {nextBefore ? (loadingMore ? 'Loading...' : 'Load more') : 'No more activity'}
          </button>
        </div>
      </div>
    </div>
  );
}
