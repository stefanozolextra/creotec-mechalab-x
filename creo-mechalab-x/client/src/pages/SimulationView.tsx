import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CyberTransition from '../components/CyberTransition';
import SimulationApp from '../simulation/SimulationApp';
import { getTraineeDashboard } from '../api/trainees';

export default function SimulationView() {
    const { id } = useParams();
    const navigate = useNavigate();

    // The route ID is directly the Activity Number (1, 2, 3, 4, 5)
    const simulationRouteId = id ?? '1';

    const [completedRoutes, setCompletedRoutes] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let active = true;
        const controller = new AbortController();

        const fetchProgress = async () => {
            try {
                // Ping the backend to get the exact trainee progress
                const dashboard = await getTraineeDashboard({ signal: controller.signal });
                if (!active) return;

                // 1. Map the raw database simulation_ids to their completion status
                const progressMap = new Map<number, boolean>();
                dashboard.simulationProgress.forEach(p => {
                    const isCompleted = Number(p.is_completed) === 1 || p.is_completed === true || String(p.is_completed).toLowerCase() === 'true';
                    progressMap.set(Number(p.simulation_id), isCompleted);
                });

                // 2. Cross-reference the completed IDs with the Activity Numbers (order_no)
                const completedOrderNos: string[] = [];
                dashboard.moduleContent.simulations.forEach(s => {
                    if (progressMap.get(Number(s.simulation_id))) {
                        const orderNo = Number(s.order_no);
                        if (orderNo > 0) {
                            completedOrderNos.push(String(orderNo));
                        }
                    }
                });

                setCompletedRoutes(completedOrderNos);
            } catch (e) {
                console.error("Failed to sync simulation progress", e);
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
    }, []);

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
                    routeId={simulationRouteId}
                    initialCompletedRoutes={completedRoutes}
                    onNavigateBack={() => navigate('/dashboard')}
                />
            )}
        </CyberTransition>
    );
}