export const SIMULATION_STATE_STORAGE_KEY = 'creosim_simulation_states';
export const DEFAULT_ACTIVITY_MODULE_ID = 1;

export type StoredSimulationStates<T = unknown> = Record<string, T>;
export type SimulationNavigationTarget = {
  routeId?: string | number | null;
  moduleId?: string | number | null;
  activityModuleId?: string | number | null;
  simulationId?: string | number | null;
};

export const normalizeActivityRouteId = (routeId?: string | number | null): string | null => {
  if (routeId === null || routeId === undefined) return null;

  const normalizedRouteId = String(routeId).trim();
  return normalizedRouteId ? normalizedRouteId : null;
};

export const normalizeActivityModuleId = (moduleId?: string | number | null): number | null => {
  const parsedModuleId = Number(moduleId);
  return Number.isInteger(parsedModuleId) && parsedModuleId > 0 ? parsedModuleId : null;
};

export const normalizeActivitySimulationId = (simulationId?: string | number | null): number | null => {
  const parsedSimulationId = Number(simulationId);
  return Number.isInteger(parsedSimulationId) && parsedSimulationId > 0 ? parsedSimulationId : null;
};

export const resolveSimulationRouteId = (
  routeId?: string | number | null,
  orderNo?: string | number | null,
): string | null => {
  const normalizedRouteId = normalizeActivityRouteId(routeId);
  if (normalizedRouteId) return normalizedRouteId;

  const parsedOrderNo = Number(orderNo);
  return Number.isInteger(parsedOrderNo) && parsedOrderNo > 0 ? String(parsedOrderNo) : null;
};

export const resolveSimulationRuntimeModuleId = (
  runtimeModuleId?: string | number | null,
  fallbackModuleId?: string | number | null,
): number | null => {
  return normalizeActivityModuleId(runtimeModuleId)
    ?? normalizeActivityModuleId(fallbackModuleId)
    ?? DEFAULT_ACTIVITY_MODULE_ID;
};

export const buildActivityStateKey = (
  routeId?: string | number | null,
  moduleId?: string | number | null,
): string | null => {
  const normalizedRouteId = normalizeActivityRouteId(routeId);
  if (!normalizedRouteId) return null;

  const normalizedModuleId = normalizeActivityModuleId(moduleId);
  return normalizedModuleId ? `M${normalizedModuleId}:${normalizedRouteId}` : normalizedRouteId;
};

export const getActivityStateKeyCandidates = (
  routeId?: string | number | null,
  moduleId?: string | number | null,
): string[] => {
  const normalizedRouteId = normalizeActivityRouteId(routeId);
  if (!normalizedRouteId) return [];

  const normalizedModuleId = normalizeActivityModuleId(moduleId);
  if (normalizedModuleId === DEFAULT_ACTIVITY_MODULE_ID) {
    return [`M${DEFAULT_ACTIVITY_MODULE_ID}:${normalizedRouteId}`, normalizedRouteId];
  }

  if (normalizedModuleId) {
    return [`M${normalizedModuleId}:${normalizedRouteId}`];
  }

  return [normalizedRouteId];
};

export const buildSimulationPath = ({
  routeId,
  moduleId,
  activityModuleId,
  simulationId,
}: SimulationNavigationTarget): string => {
  const safeRouteId = normalizeActivityRouteId(routeId) ?? '1';
  const params = new URLSearchParams();

  const safeModuleId = normalizeActivityModuleId(moduleId);
  if (safeModuleId) {
    params.set('module', String(safeModuleId));
  }

  const safeActivityModuleId = normalizeActivityModuleId(activityModuleId);
  if (safeActivityModuleId) {
    params.set('activity_module', String(safeActivityModuleId));
  }

  const safeSimulationId = normalizeActivitySimulationId(simulationId);
  if (safeSimulationId) {
    params.set('simulation', String(safeSimulationId));
  }

  const query = params.toString();
  return `/simulation/${encodeURIComponent(safeRouteId)}${query ? `?${query}` : ''}`;
};

export const getStoredSimulationStates = <T = unknown>(
  storageKey = SIMULATION_STATE_STORAGE_KEY,
): StoredSimulationStates<T> => {
  if (typeof window === 'undefined') return {};

  try {
    const storedValue = window.localStorage.getItem(storageKey);
    return storedValue ? (JSON.parse(storedValue) as StoredSimulationStates<T>) : {};
  } catch {
    return {};
  }
};

export const getStoredActivityState = <T = unknown>(
  storedStates: StoredSimulationStates<T>,
  routeId?: string | number | null,
  moduleId?: string | number | null,
): T | null => {
  for (const key of getActivityStateKeyCandidates(routeId, moduleId)) {
    if (key in storedStates) {
      return storedStates[key] ?? null;
    }
  }

  return null;
};

export const hasStoredActivityState = <T = unknown>(
  storedStates: StoredSimulationStates<T>,
  routeId?: string | number | null,
  moduleId?: string | number | null,
): boolean => getStoredActivityState(storedStates, routeId, moduleId) !== null;
