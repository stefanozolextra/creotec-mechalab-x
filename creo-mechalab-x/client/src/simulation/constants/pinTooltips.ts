import { getPinMeta as getPinMetaHelper } from '../Previous Files/utils/simulationHelpers';

// Pin tooltip customization:
// 1) `TERMINAL_STRIP_TOOLTIP_BY_COMPONENT` for per-strip labels (highest priority)
// 2) `TERMINAL_STRIP_TOOLTIP_BY_TYPE` for strip-type defaults
// If a pin is not configured, fallback is the raw pin id.
export const TERMINAL_STRIP_TOOLTIP_BY_COMPONENT: Partial<Record<string, Partial<Record<string, string>>>> = {
  'battery-1': {
    pin_1: 'Positive',
    pin_2: 'Positive',
    pin_3: 'Positive',
    pin_4: 'Positive',
    pin_5: 'Positive',
    pin_6: 'Positive',
    pin_7: 'Positive',
    pin_8: 'Positive',
    pin_9: 'Positive',
    pin_10: 'Positive',
    pin_11: 'Positive',
    pin_12: 'Positive',
  },
  'battery-2': {
    pin_1: 'Negative',
    pin_2: 'Negative',
    pin_3: 'Negative',
    pin_4: 'Negative',
    pin_5: 'Negative',
    pin_6: 'Negative',
    pin_7: 'Negative',
    pin_8: 'Negative',
    pin_9: 'Negative',
    pin_10: 'Negative',
    pin_11: 'Negative',
    pin_12: 'Negative',
  },
  'lightIndicator-1': {
    pin_1: 'G - X1',
    pin_2: 'G - X2',
    pin_3: 'Y - X1',
    pin_4: 'Y - X2',
    pin_5: 'R - X1',
    pin_6: 'R - X2',
    pin_7: 'Buzzer +',
    pin_8: 'Buzzer -',
    pin_9: '',
    pin_10: '',
    pin_11: '',
    pin_12: '',
  },
  'relayModule-1': {
    pin_1: '14',
    pin_2: '13',
    pin_3: '1',
    pin_4: '2',
    pin_5: '3',
    pin_6: '5',
    pin_7: '6',
    pin_8: '7',
    pin_9: '9',
    pin_10: '10',
    pin_11: '11',
    pin_12: '',
  },
  'relayModule-2': {
    pin_1: '14',
    pin_2: '13',
    pin_3: '1',
    pin_4: '2',
    pin_5: '3',
    pin_6: '5',
    pin_7: '6',
    pin_8: '7',
    pin_9: '9',
    pin_10: '10',
    pin_11: '11',
    pin_12: '',
  },
  'relayModule-3': {
    pin_1: '14',
    pin_2: '13',
    pin_3: '1',
    pin_4: '2',
    pin_5: '3',
    pin_6: '5',
    pin_7: '6',
    pin_8: '7',
    pin_9: '9',
    pin_10: '10',
    pin_11: '11',
    pin_12: '',
  },
  'counter-1': {
    pin_1: '',
    pin_2: '',
    pin_3: '',
    pin_4: '',
    pin_5: '8',
    pin_6: '7',
    pin_7: '6',
    pin_8: '5',
    pin_9: '4',
    pin_10: '3',
    pin_11: '2',
    pin_12: '1',
  },
  'timer-1': {
    pin_1: '',
    pin_2: '',
    pin_3: '',
    pin_4: '',
    pin_5: '8',
    pin_6: '7',
    pin_7: '6',
    pin_8: '5',
    pin_9: '4',
    pin_10: '3',
    pin_11: '2',
    pin_12: '1',
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
    console.debug('[resolveTerminalStripTooltip] fromComponent', fullPinId, componentId, pinName, '=>', fromComponent);
    return fromComponent;
  }

  const componentType = inferComponentType(componentId);
  console.debug('[resolveTerminalStripTooltip] fallback', fullPinId, componentId, pinName, 'componentType=', componentType);
  if (!componentType) {
    return undefined;
  }

  // If there's a canonical per-component mapping for the first instance (e.g. 'timer-1'),
  // prefer that before falling back to the per-type map. This lets instance names like
  // 'counter-2' or 'timer-3' inherit labels from 'counter-1' / 'timer-1'.
  const canonicalInstanceKey = `${componentType}-1`;
  const fromCanonical = TERMINAL_STRIP_TOOLTIP_BY_COMPONENT[canonicalInstanceKey]?.[pinName];
  if (fromCanonical) {
    console.debug('[resolveTerminalStripTooltip] canonical', fullPinId, canonicalInstanceKey, pinName, '=>', fromCanonical);
    return fromCanonical;
  }

  const byType = TERMINAL_STRIP_TOOLTIP_BY_TYPE[componentType]?.[pinName];
  console.debug('[resolveTerminalStripTooltip] byType', fullPinId, componentType, pinName, '=>', byType);
  return byType;
};
