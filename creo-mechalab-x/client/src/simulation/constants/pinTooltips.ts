import { getPinMeta as getPinMetaHelper } from '../utils/simulationHelpers';

// Pin tooltip customization:
// 1) `TERMINAL_STRIP_TOOLTIP_BY_COMPONENT` for per-strip labels (highest priority)
// 2) `TERMINAL_STRIP_TOOLTIP_BY_TYPE` for strip-type defaults
// If a pin is not configured, fallback is the raw pin id.
export const TERMINAL_STRIP_TOOLTIP_BY_COMPONENT: Partial<Record<string, Partial<Record<string, string>>>> = {
  'battery-1': {
    pin_1: 'Negative',
    pin_2: 'Negative',
    pin_3: 'Negative',
    pin_4: 'Negative',
    pin_5: 'Negative',
    pin_6: 'No Connection',
    pin_7: 'No Connection',
    pin_8: 'Positive',
    pin_9: 'Positive',
    pin_10: 'Positive',
    pin_11: 'Positive',
    pin_12: 'Positive',
  },
  'lightIndicator-1': {
    pin_1: 'No Connection',
    pin_2: 'Ground',
    pin_3: 'Positive',
    pin_4: 'No Connection',
    pin_5: 'No Connection',
    pin_6: 'Ground',
    pin_7: 'Positive',
    pin_8: 'No Connection',
    pin_9: 'No Connection',
    pin_10: 'Ground',
    pin_11: 'Positive',
    pin_12: 'No Connection',
  },
};

export const TERMINAL_STRIP_TOOLTIP_BY_TYPE: Partial<Record<string, Partial<Record<string, string>>>> = {
  battery: {
    pin_1: 'Positive rail (+)',
    pin_8: 'Negative rail (-)',
  },
  relayModule: {
    pin_1: 'Relay module terminal 1',
    pin_2: 'Relay module terminal 2',
  },
};

export const resolveTerminalStripTooltip = (
  fullPinId: string,
  inferComponentType: (componentId: string) => string | null,
): string | undefined => {
  const { componentId, pinName } = getPinMetaHelper(fullPinId);
  const fromComponent = TERMINAL_STRIP_TOOLTIP_BY_COMPONENT[componentId]?.[pinName];
  if (fromComponent) {
    return fromComponent;
  }

  const componentType = inferComponentType(componentId);
  if (!componentType) {
    return undefined;
  }

  return TERMINAL_STRIP_TOOLTIP_BY_TYPE[componentType]?.[pinName];
};
