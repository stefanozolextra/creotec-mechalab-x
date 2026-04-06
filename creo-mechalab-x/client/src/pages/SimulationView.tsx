import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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

    useEffect(() => {
        let active = true;
        const controller = new AbortController();

        const fetchProgress = async () => {
            try {
                const dashboard = await getTraineeDashboard({ signal: controller.signal });
                if (!active) return;

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
