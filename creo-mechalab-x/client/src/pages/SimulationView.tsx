import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, BookOpen } from 'lucide-react';
import CyberTransition from '../components/CyberTransition';
import SimulationApp from '../simulation/SimulationApp';
import PLCSimulationApp from '../simulation/PLCSimulationApp';
import { getTraineeDashboard } from '../api/trainees';
import {
    buildActivityStateKey,
    normalizeActivityModuleId,
    normalizeActivityRouteId,
    normalizeActivitySimulationId,
    resolveSimulationRouteId,
    resolveSimulationRuntimeModuleId,
} from '../simulation/utils/activityState';

type SimulationLocationState = {
    moduleId?: unknown;
    activityModuleId?: unknown;
    simulationId?: unknown;
} | null;

type SimulationActivityEntry = {
    simulationId?: number;
    routeId: string;
    activityModuleId?: number | null;
    orderNo: number;
    title: string;
};

export default function SimulationView() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const locationState = (location.state as SimulationLocationState) ?? null;
    const requestedModuleId = normalizeActivityModuleId(
        locationState?.moduleId as string | number | null | undefined,
    ) ?? normalizeActivityModuleId(searchParams.get('module'));
    const requestedActivityModuleId = normalizeActivityModuleId(
        locationState?.activityModuleId as string | number | null | undefined,
    ) ?? normalizeActivityModuleId(searchParams.get('activity_module'));
    const simulationId = normalizeActivitySimulationId(locationState?.simulationId as string | number | null | undefined)
        ?? normalizeActivitySimulationId(searchParams.get('simulation'))
        ?? undefined;
    const simulationRouteId = normalizeActivityRouteId(id) ?? '1';

    const [resolvedModuleId, setResolvedModuleId] = useState<number | null>(requestedModuleId);
    const [completedRoutes, setCompletedRoutes] = useState<string[]>([]);
    const [activityEntries, setActivityEntries] = useState<SimulationActivityEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [restrictionMessage, setRestrictionMessage] = useState<string | null>(null);

    useEffect(() => {
        let active = true;
        const controller = new AbortController();

        const fetchProgress = async () => {
            try {
                const dashboard = await getTraineeDashboard({ signal: controller.signal });
                if (!active) return;

                if (dashboard.trainee?.access_mode === 'lesson_only') {
                    setRestrictionMessage('This trainee account has lesson-only access. Simulations are disabled.');
                    setCompletedRoutes([]);
                    setActivityEntries([]);
                    return;
                }

                setRestrictionMessage(null);
                const progressMap = new Map<number, boolean>();
                dashboard.simulationProgress.forEach((progressRow) => {
                    const isCompleted =
                        Number(progressRow.is_completed) === 1
                        || progressRow.is_completed === true
                        || String(progressRow.is_completed).toLowerCase() === 'true';
                    progressMap.set(Number(progressRow.simulation_id), isCompleted);
                });

                const matchedSimulationById = simulationId
                    ? dashboard.moduleContent.simulations.find(
                        (simulationRow) => Number(simulationRow.simulation_id) === simulationId,
                    ) ?? null
                    : null;

                const effectiveModuleId = requestedModuleId
                    ?? normalizeActivityModuleId(matchedSimulationById?.module_id)
                    ?? null;
                setResolvedModuleId(effectiveModuleId);

                const scopedSimulations = dashboard.moduleContent.simulations
                    .filter((simulationRow) => {
                        const ownerModuleId = normalizeActivityModuleId(simulationRow.module_id);
                        if (effectiveModuleId !== null) {
                            return ownerModuleId === effectiveModuleId;
                        }

                        if (simulationId) {
                            return Number(simulationRow.simulation_id) === simulationId;
                        }

                        return false;
                    })
                    .map((simulationRow) => {
                        const routeId = resolveSimulationRouteId(simulationRow.route_id, simulationRow.order_no);
                        if (!routeId) return null;

                        return {
                            simulationId: Number(simulationRow.simulation_id),
                            routeId,
                            activityModuleId: resolveSimulationRuntimeModuleId(
                                simulationRow.runtime_module_id,
                                requestedActivityModuleId ?? simulationRow.module_id,
                            ),
                            orderNo: Number(simulationRow.order_no) || Number.MAX_SAFE_INTEGER,
                            title: typeof simulationRow.title === 'string' ? simulationRow.title : routeId,
                        } as SimulationActivityEntry;
                    })
                    .filter((entry): entry is SimulationActivityEntry => entry !== null)
                    .sort((left, right) => {
                        if (left.orderNo !== right.orderNo) return left.orderNo - right.orderNo;
                        if ((left.simulationId ?? 0) !== (right.simulationId ?? 0)) {
                            return (left.simulationId ?? 0) - (right.simulationId ?? 0);
                        }
                        return left.routeId.localeCompare(right.routeId);
                    });

                const inferredRouteModuleId = simulationRouteId.startsWith('6.')
                    ? 6
                    : simulationRouteId.startsWith('5.')
                        ? 5
                        : null;
                const fallbackEntry: SimulationActivityEntry = {
                    simulationId,
                    routeId: simulationRouteId,
                    activityModuleId: inferredRouteModuleId
                        ?? resolveSimulationRuntimeModuleId(
                            requestedActivityModuleId,
                            effectiveModuleId,
                        ),
                    orderNo: 1,
                    title: simulationRouteId,
                };

                const nextActivityEntries = scopedSimulations.length > 0 ? scopedSimulations : [fallbackEntry];
                setActivityEntries(nextActivityEntries);

                const completedRouteKeys = nextActivityEntries
                    .filter((entry) => entry.simulationId && progressMap.get(entry.simulationId))
                    .map((entry) => buildActivityStateKey(entry.routeId, effectiveModuleId))
                    .filter((value): value is string => Boolean(value));

                setCompletedRoutes(completedRouteKeys);
            } catch (error) {
                console.error('Failed to sync simulation progress', error);
            } finally {
                if (active) {
                    setIsLoading(false);
                }
            }
        };

        fetchProgress();

        return () => {
            active = false;
            controller.abort();
        };
    }, [requestedActivityModuleId, requestedModuleId, simulationId, simulationRouteId]);

    const currentActivityEntry = useMemo(() => {
        if (simulationId) {
            const bySimulationId = activityEntries.find((entry) => entry.simulationId === simulationId) ?? null;
            if (bySimulationId) return bySimulationId;
        }

        return activityEntries.find((entry) => entry.routeId === simulationRouteId) ?? null;
    }, [activityEntries, simulationId, simulationRouteId]);

    const inferredRouteModuleId = simulationRouteId.startsWith('6.')
        ? 6
        : simulationRouteId.startsWith('5.')
            ? 5
            : undefined;
    const effectiveActivityModuleId = inferredRouteModuleId
        ?? currentActivityEntry?.activityModuleId
        ?? resolveSimulationRuntimeModuleId(requestedActivityModuleId, resolvedModuleId)
        ?? undefined;
    const shouldRenderPlcSimulation = simulationRouteId.startsWith('6.')
        || effectiveActivityModuleId === 6
        || resolvedModuleId === 6;

    return (
        <CyberTransition>
            {isLoading ? (
                <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-slate-200">
                    <div>
                        <div className="w-10 h-10 border-4 border-slate-700 border-t-cyan-500 rounded-full animate-spin mx-auto mb-6"></div>
                        <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-400">Simulation Loader</p>
                        <p className="mt-3 text-sm font-semibold text-slate-300">Syncing trainee progress...</p>
                    </div>
                </div>
            ) : restrictionMessage ? (
                <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-200">
                    <div className="w-full max-w-xl rounded-3xl border border-amber-500/30 bg-slate-900/90 p-8 text-center shadow-2xl">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-300">
                            <AlertTriangle size={28} />
                        </div>
                        <h1 className="mt-5 text-lg font-black uppercase tracking-[0.2em] text-amber-200">Simulation Blocked</h1>
                        <p className="mt-4 text-sm font-medium text-slate-300">{restrictionMessage}</p>
                        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                            {resolvedModuleId !== null ? (
                                <button
                                    type="button"
                                    onClick={() => navigate(`/module/${resolvedModuleId}`)}
                                    className="inline-flex items-center justify-center gap-2 rounded-full bg-cyan-500 px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-slate-950 transition-colors hover:bg-cyan-400"
                                >
                                    <BookOpen size={14} />
                                    Open Lesson
                                </button>
                            ) : null}
                            <button
                                type="button"
                                onClick={() => navigate('/dashboard')}
                                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800"
                            >
                                <ArrowLeft size={14} />
                                Back To Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                shouldRenderPlcSimulation ? (
                    <PLCSimulationApp
                        key={`plc:${resolvedModuleId ?? 'legacy'}:${effectiveActivityModuleId ?? 'default'}:${simulationRouteId}:${simulationId ?? 'anonymous'}`}
                        routeId={simulationRouteId}
                        moduleId={resolvedModuleId ?? undefined}
                        activityModuleId={effectiveActivityModuleId}
                        simulationId={simulationId}
                        activityEntries={activityEntries}
                        initialCompletedRoutes={completedRoutes}
                        onNavigateBack={() => navigate('/dashboard')}
                    />
                ) : (
                    <SimulationApp
                        key={`${resolvedModuleId ?? 'legacy'}:${effectiveActivityModuleId ?? 'default'}:${simulationRouteId}:${simulationId ?? 'anonymous'}`}
                        routeId={simulationRouteId}
                        moduleId={resolvedModuleId ?? undefined}
                        activityModuleId={effectiveActivityModuleId}
                        simulationId={simulationId}
                        activityEntries={activityEntries}
                        initialCompletedRoutes={completedRoutes}
                        onNavigateBack={() => navigate('/dashboard')}
                    />
                )
            )}
        </CyberTransition>
    );
}
