import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, BookOpen } from 'lucide-react';
import CyberTransition from '../components/CyberTransition';
import SimulationApp from '../simulation/SimulationApp';
import { getTraineeDashboard } from '../api/trainees';
import {
    buildActivityStateKey,
    normalizeActivityModuleId,
    normalizeActivityRouteId,
} from '../simulation/utils/activityState';

type SimulationLocationState = {
    moduleId?: unknown;
    simulationId?: unknown;
} | null;

export default function SimulationView() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const locationState = (location.state as SimulationLocationState) ?? null;
    const moduleId = normalizeActivityModuleId(
        locationState?.moduleId as string | number | null | undefined,
    );
    const simulationId = (() => {
        const parsedSimulationId = Number(locationState?.simulationId);
        return Number.isInteger(parsedSimulationId) && parsedSimulationId > 0 ? parsedSimulationId : undefined;
    })();

    const simulationRouteId = normalizeActivityRouteId(id) ?? '1';

    const [completedRoutes, setCompletedRoutes] = useState<string[]>([]);
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

                const completedOrderNos: string[] = [];
                dashboard.moduleContent.simulations.forEach((simulationRow) => {
                    const simulationModuleId = Number(simulationRow.module_id);
                    if (moduleId !== null && simulationModuleId !== moduleId) {
                        return;
                    }

                    if (moduleId === null && simulationModuleId !== 1) {
                        return;
                    }

                    if (!progressMap.get(Number(simulationRow.simulation_id))) {
                        return;
                    }

                    const orderNo = Number(simulationRow.order_no);
                    if (orderNo <= 0) {
                        return;
                    }

                    const completionKey = moduleId === null
                        ? String(orderNo)
                        : buildActivityStateKey(orderNo, moduleId);
                    if (completionKey) {
                        completedOrderNos.push(completionKey);
                    }
                });

                setCompletedRoutes(completedOrderNos);
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
    }, [moduleId]);

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
                            {moduleId !== null ? (
                                <button
                                    type="button"
                                    onClick={() => navigate(`/module/${moduleId}`)}
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
                <SimulationApp
                    key={`${moduleId ?? 'legacy'}:${simulationRouteId}`}
                    routeId={simulationRouteId}
                    moduleId={moduleId ?? undefined}
                    simulationId={simulationId}
                    initialCompletedRoutes={completedRoutes}
                    onNavigateBack={() => navigate('/dashboard')}
                />
            )}
        </CyberTransition>
    );
}
