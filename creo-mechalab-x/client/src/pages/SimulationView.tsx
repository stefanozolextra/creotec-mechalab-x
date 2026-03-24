import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import CyberTransition from '../components/CyberTransition';
import SimulationApp from '../simulation/SimulationApp';
import { getTraineeDashboard } from '../api/trainees';

type SimulationLocationState = {
    simulationOrderNo?: unknown;
} | null;

const toPositiveInt = (value: unknown): number | null => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

export default function SimulationView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const locationState = (location.state as SimulationLocationState) ?? null;
    const routeSimulationId = toPositiveInt(id);
    const hintedOrderNo = toPositiveInt(locationState?.simulationOrderNo);

    const [resolvedActivityRouteId, setResolvedActivityRouteId] = useState<string | null>(() => {
        if (hintedOrderNo) return String(hintedOrderNo);
        if (routeSimulationId && routeSimulationId <= 2) return String(routeSimulationId);
        return null;
    });
    const [isResolvingActivity, setIsResolvingActivity] = useState<boolean>(() => !hintedOrderNo && !!routeSimulationId && routeSimulationId > 2);

    useEffect(() => {
        if (hintedOrderNo) {
            setResolvedActivityRouteId(String(hintedOrderNo));
            setIsResolvingActivity(false);
            return;
        }

        if (routeSimulationId === null) {
            setResolvedActivityRouteId(id ?? '1');
            setIsResolvingActivity(false);
            return;
        }

        if (routeSimulationId <= 2) {
            setResolvedActivityRouteId(String(routeSimulationId));
            setIsResolvingActivity(false);
            return;
        }

        let active = true;
        const controller = new AbortController();

        const resolveActivityRouteId = async () => {
            setIsResolvingActivity(true);

            try {
                const dashboard = await getTraineeDashboard({ signal: controller.signal });
                if (!active || controller.signal.aborted) return;

                const simulation = dashboard.moduleContent.simulations.find(
                    (entry) => toPositiveInt(entry.simulation_id) === routeSimulationId,
                );
                const orderNo = simulation ? toPositiveInt(simulation.order_no) : null;
                setResolvedActivityRouteId(orderNo ? String(orderNo) : String(routeSimulationId));
            } catch {
                if (!active || controller.signal.aborted) return;
                setResolvedActivityRouteId(String(routeSimulationId));
            } finally {
                if (active && !controller.signal.aborted) {
                    setIsResolvingActivity(false);
                }
            }
        };

        void resolveActivityRouteId();

        return () => {
            active = false;
            controller.abort();
        };
    }, [hintedOrderNo, id, routeSimulationId]);

    const simulationRouteId = useMemo(
        () => resolvedActivityRouteId ?? (id || undefined),
        [resolvedActivityRouteId, id],
    );

    return (
        <CyberTransition>
            {isResolvingActivity && !resolvedActivityRouteId ? (
                <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-center text-slate-200">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.3em] text-cyan-400">Simulation Loader</p>
                        <p className="mt-3 text-sm font-semibold text-slate-300">Resolving activity layout...</p>
                    </div>
                </div>
            ) : (
                <SimulationApp
                    routeId={simulationRouteId}
                    onNavigateBack={() => navigate('/dashboard')}
                />
            )}
        </CyberTransition>
    );
}
