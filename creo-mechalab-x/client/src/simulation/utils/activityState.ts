export const SIMULATION_STATE_STORAGE_KEY = 'creosim_simulation_states';
export const DEFAULT_ACTIVITY_MODULE_ID = 1;

export type StoredSimulationStates<T = unknown> = Record<string, T>;

export const normalizeActivityRouteId = (routeId?: string | number | null): string | null => {
  if (routeId === null || routeId === undefined) return null;

  const normalizedRouteId = String(routeId).trim();
  return normalizedRouteId ? normalizedRouteId : null;
};

export const normalizeActivityModuleId = (moduleId?: string | number | null): number | null => {
  const parsedModuleId = Number(moduleId);
  return Number.isInteger(parsedModuleId) && parsedModuleId > 0 ? parsedModuleId : null;
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
