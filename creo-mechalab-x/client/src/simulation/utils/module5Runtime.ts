export type Module5RouteId = '5.1' | '5.2' | '5.3' | '5.4' | '5.5';
export type Module5CylinderId = 'A' | 'B';
export type Module5Direction = 'extend' | 'retract' | 'idle';
export type Module5LimitSwitchId = 'LS1' | 'LS2' | 'LS3' | 'LS4';
export type Module5RuntimeStatus = 'idle' | 'running' | 'stopped';
export type Module5ValveSide = 'extend' | 'retract' | null;

type Module5Step = {
  cylinder: Module5CylinderId;
  direction: Exclude<Module5Direction, 'idle'>;
  touchLimitSwitch: Module5LimitSwitchId;
};

type Module5SequenceDefinition = {
  steps: readonly Module5Step[];
  loops: boolean;
};

type Module5CylinderState = {
  position: number;
  direction: Module5Direction;
};

export type Module5RuntimeState = {
  status: Module5RuntimeStatus;
  routeId: Module5RouteId | null;
  stepIndex: number;
  activeLimitSwitch: Module5LimitSwitchId | null;
  holdRemainingMs: number;
  cylinders: Record<Module5CylinderId, Module5CylinderState>;
};

export const MODULE5_ROUTE_IDS: readonly Module5RouteId[] = ['5.1', '5.2', '5.3', '5.4', '5.5'];
const MODULE5_TRAVEL_DURATION_MS = 850;
const MODULE5_LIMIT_SWITCH_HOLD_MS = 180;

export const MODULE5_SEQUENCE_DEFINITIONS: Record<Module5RouteId, Module5SequenceDefinition> = {
  '5.1': {
    steps: [
      { cylinder: 'A', direction: 'extend', touchLimitSwitch: 'LS2' },
      { cylinder: 'A', direction: 'retract', touchLimitSwitch: 'LS1' },
    ],
    loops: true,
  },
  '5.2': {
    steps: [
      { cylinder: 'A', direction: 'extend', touchLimitSwitch: 'LS2' },
      { cylinder: 'A', direction: 'retract', touchLimitSwitch: 'LS1' },
    ],
    loops: true,
  },
  '5.3': {
    steps: [
      { cylinder: 'A', direction: 'extend', touchLimitSwitch: 'LS2' },
      { cylinder: 'B', direction: 'extend', touchLimitSwitch: 'LS4' },
      { cylinder: 'A', direction: 'retract', touchLimitSwitch: 'LS1' },
      { cylinder: 'B', direction: 'retract', touchLimitSwitch: 'LS3' },
    ],
    loops: true,
  },
  '5.4': {
    steps: [
      { cylinder: 'A', direction: 'extend', touchLimitSwitch: 'LS2' },
      { cylinder: 'B', direction: 'extend', touchLimitSwitch: 'LS4' },
      { cylinder: 'B', direction: 'retract', touchLimitSwitch: 'LS3' },
      { cylinder: 'A', direction: 'retract', touchLimitSwitch: 'LS1' },
    ],
    loops: true,
  },
  '5.5': {
    steps: [
      { cylinder: 'A', direction: 'extend', touchLimitSwitch: 'LS2' },
      { cylinder: 'A', direction: 'retract', touchLimitSwitch: 'LS1' },
      { cylinder: 'B', direction: 'extend', touchLimitSwitch: 'LS4' },
      { cylinder: 'B', direction: 'retract', touchLimitSwitch: 'LS3' },
    ],
    loops: true,
  },
};

const clampPosition = (value: number) => Math.max(0, Math.min(1, value));

const createCylinderState = (): Module5CylinderState => ({
  position: 0,
  direction: 'idle',
});

export const createModule5RuntimeState = (): Module5RuntimeState => ({
  status: 'idle',
  routeId: null,
  stepIndex: 0,
  activeLimitSwitch: null,
  holdRemainingMs: 0,
  cylinders: {
    A: createCylinderState(),
    B: createCylinderState(),
  },
});

export const isModule5RouteId = (routeId?: string | null): routeId is Module5RouteId =>
  typeof routeId === 'string' && MODULE5_ROUTE_IDS.includes(routeId as Module5RouteId);

const getSequenceStep = (routeId: Module5RouteId, stepIndex: number) => {
  const definition = MODULE5_SEQUENCE_DEFINITIONS[routeId];
  return definition.steps[stepIndex] ?? definition.steps[0];
};

const advanceStepIndex = (routeId: Module5RouteId, currentStepIndex: number) => {
  const definition = MODULE5_SEQUENCE_DEFINITIONS[routeId];
  const nextStepIndex = currentStepIndex + 1;

  if (nextStepIndex < definition.steps.length) {
    return nextStepIndex;
  }

  return definition.loops ? 0 : currentStepIndex;
};

export const startModule5Runtime = (routeId: Module5RouteId, previousState?: Module5RuntimeState): Module5RuntimeState => {
  if (previousState?.routeId === routeId && previousState.status === 'stopped') {
    const resumedStep = getSequenceStep(routeId, previousState.stepIndex);

    return {
      ...previousState,
      status: 'running',
      activeLimitSwitch: null,
      holdRemainingMs: 0,
      cylinders: {
        A: { ...previousState.cylinders.A, direction: resumedStep.cylinder === 'A' ? resumedStep.direction : 'idle' },
        B: { ...previousState.cylinders.B, direction: resumedStep.cylinder === 'B' ? resumedStep.direction : 'idle' },
      },
    };
  }

  const baseState = createModule5RuntimeState();
  const firstStep = getSequenceStep(routeId, 0);

  return {
    ...baseState,
    status: 'running',
    routeId,
    cylinders: {
      A: {
        ...baseState.cylinders.A,
        direction: firstStep.cylinder === 'A' ? firstStep.direction : 'idle',
      },
      B: {
        ...baseState.cylinders.B,
        direction: firstStep.cylinder === 'B' ? firstStep.direction : 'idle',
      },
    },
  };
};

export const stopModule5Runtime = (state: Module5RuntimeState): Module5RuntimeState => ({
  ...state,
  status: state.routeId ? 'stopped' : 'idle',
  activeLimitSwitch: null,
  holdRemainingMs: 0,
  cylinders: {
    A: { ...state.cylinders.A, direction: 'idle' },
    B: { ...state.cylinders.B, direction: 'idle' },
  },
});

export const resetModule5Runtime = (): Module5RuntimeState => createModule5RuntimeState();

export const advanceModule5Runtime = (state: Module5RuntimeState, deltaMs: number): Module5RuntimeState => {
  if (state.status !== 'running' || !state.routeId) {
    return state;
  }

  const step = getSequenceStep(state.routeId, state.stepIndex);
  const nextState: Module5RuntimeState = {
    ...state,
    cylinders: {
      A: { ...state.cylinders.A },
      B: { ...state.cylinders.B },
    },
  };

  if (nextState.holdRemainingMs > 0) {
    const remainingHold = Math.max(0, nextState.holdRemainingMs - deltaMs);
    nextState.holdRemainingMs = remainingHold;

    if (remainingHold > 0) {
      return nextState;
    }

    nextState.activeLimitSwitch = null;
    nextState.stepIndex = advanceStepIndex(nextState.routeId, nextState.stepIndex);
    const nextStep = getSequenceStep(nextState.routeId, nextState.stepIndex);
    nextState.cylinders.A.direction = nextStep.cylinder === 'A' ? nextStep.direction : 'idle';
    nextState.cylinders.B.direction = nextStep.cylinder === 'B' ? nextStep.direction : 'idle';
    return nextState;
  }

  const targetPosition = step.direction === 'extend' ? 1 : 0;
  const currentCylinder = nextState.cylinders[step.cylinder];
  const positionDelta = deltaMs / MODULE5_TRAVEL_DURATION_MS;
  const nextPosition = step.direction === 'extend'
    ? clampPosition(currentCylinder.position + positionDelta)
    : clampPosition(currentCylinder.position - positionDelta);

  currentCylinder.position = nextPosition;
  currentCylinder.direction = step.direction;
  nextState.cylinders[step.cylinder === 'A' ? 'B' : 'A'].direction = 'idle';

  const reachedEndpoint = step.direction === 'extend'
    ? nextPosition >= targetPosition
    : nextPosition <= targetPosition;

  if (!reachedEndpoint) {
    return nextState;
  }

  currentCylinder.position = targetPosition;
  currentCylinder.direction = 'idle';
  nextState.activeLimitSwitch = step.touchLimitSwitch;
  nextState.holdRemainingMs = MODULE5_LIMIT_SWITCH_HOLD_MS;
  return nextState;
};

export const getModule5ValveIndicators = (state: Module5RuntimeState): Record<Module5CylinderId, Module5ValveSide> => ({
  A: state.cylinders.A.direction === 'idle' ? null : state.cylinders.A.direction,
  B: state.cylinders.B.direction === 'idle' ? null : state.cylinders.B.direction,
});
