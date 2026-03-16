import { RELAY_PORTS } from '../constants/relayBoard';
import type {
  ActivityAnswerDefinition,
  ActivityConnectionPair,
  ActivityCustomConnection,
} from '../constants/activityAnswers/types';

export interface ActivityEvaluationContext {
  inputDeviceIds: string[];
  outputDeviceIds: string[];
  wires: Array<{ fromPin: string; toPin: string }>;
}

export interface ActivityEvaluationResult {
  passed: boolean;
  feedback: string;
  issues: string[];
}

const DEVICE_RULE_KEY_BY_ID: Record<string, string> = {
  'push-button': 'button',
  buzzer: 'buzzer',
  counter: 'counter',
  'light-indicator': 'lightIndicator',
  'magnetic-contactor': 'magneticMotorContactor',
  'relay-module': 'relayModule',
  'roller-lever': 'rollerLever',
  'solenoid-valve': 'solenoidValve',
};

const BUILT_IN_COMPONENT_COUNTS: Record<string, number> = {
  battery: 1,
  relayModule: 1,
  lightIndicator: 1,
  buzzer: 1,
  counter: 1,
  solenoidValve: 2,
};

const RELAY_PORT_ALIAS_PATTERNS: Array<[RegExp, string]> = [
  [/^relay1_(\d+)$/, 'relay1_top_$1'],
  [/^relay2_(\d+)$/, 'relay2_top_$1'],
  [/^relay3_(\d+)$/, 'relay3_top_$1'],
];

const incrementCount = (counts: Record<string, number>, key: string) => {
  counts[key] = (counts[key] ?? 0) + 1;
};

const countDevices = (deviceIds: string[]) =>
  deviceIds.reduce<Record<string, number>>((counts, deviceId) => {
    const ruleKey = DEVICE_RULE_KEY_BY_ID[deviceId];
    if (ruleKey) {
      incrementCount(counts, ruleKey);
    }
    return counts;
  }, {});

const collectMissingCounts = (
  required: Record<string, number> | undefined,
  actual: Record<string, number>,
  scopeLabel: string,
) => {
  if (!required) return [];

  const missing = Object.entries(required).flatMap(([key, minimum]) => {
    const actualCount = actual[key] ?? 0;
    return actualCount >= minimum ? [] : `${key} x${minimum}`;
  });

  return missing.length ? [`${scopeLabel}: ${missing.join(', ')}`] : [];
};

const resolvePortId = (portId: string) => {
  if (RELAY_PORTS[portId]) return portId;

  for (const [pattern, replacement] of RELAY_PORT_ALIAS_PATTERNS) {
    const aliasedPortId = portId.replace(pattern, replacement);
    if (aliasedPortId !== portId && RELAY_PORTS[aliasedPortId]) {
      return aliasedPortId;
    }
  }

  return null;
};

const toWireKey = (fromPin: string, toPin: string) =>
  [fromPin, toPin].sort().join('|');

const isAlternativeConnectionGroup = (
  connection: ActivityCustomConnection,
): connection is ActivityConnectionPair[] => Array.isArray(connection[0]);

const evaluateCustomConnections = (
  customConnections: ActivityCustomConnection[] | undefined,
  wires: Array<{ fromPin: string; toPin: string }>,
) => {
  if (!customConnections?.length) return [];

  const issues: string[] = [];
  const wireSet = new Set(wires.map((wire) => toWireKey(wire.fromPin, wire.toPin)));

  for (const requirement of customConnections) {
    const options = isAlternativeConnectionGroup(requirement) ? requirement : [requirement];
    const resolvedOptions = options.map(([fromPin, toPin]) => ({
      originalFromPin: fromPin,
      originalToPin: toPin,
      resolvedFromPin: resolvePortId(fromPin),
      resolvedToPin: resolvePortId(toPin),
    }));

    const invalidOption = resolvedOptions.find(
      (option) => !option.resolvedFromPin || !option.resolvedToPin,
    );
    if (invalidOption) {
      const invalidPins = [
        !invalidOption.resolvedFromPin ? invalidOption.originalFromPin : null,
        !invalidOption.resolvedToPin ? invalidOption.originalToPin : null,
      ].filter(Boolean);
      issues.push(`Unknown pin id in activity answer: ${invalidPins.join(', ')}`);
      continue;
    }

    const hasMatchingConnection = resolvedOptions.some((option) =>
      wireSet.has(toWireKey(option.resolvedFromPin!, option.resolvedToPin!)),
    );

    if (hasMatchingConnection) continue;

    if (resolvedOptions.length === 1) {
      const [option] = resolvedOptions;
      issues.push(`Missing required connection: ${option.originalFromPin} <-> ${option.originalToPin}`);
      continue;
    }

    const labels = resolvedOptions
      .map((option) => `${option.originalFromPin} <-> ${option.originalToPin}`)
      .join(' OR ');
    issues.push(`Missing one required connection option: ${labels}`);
  }

  return issues;
};

export const evaluateActivityAnswer = (
  activity: ActivityAnswerDefinition,
  context: ActivityEvaluationContext,
): ActivityEvaluationResult => {
  const inputDeviceCounts = countDevices(context.inputDeviceIds);
  const outputDeviceCounts = countDevices(context.outputDeviceIds);
  const componentCounts = { ...BUILT_IN_COMPONENT_COUNTS };

  for (const deviceId of [...context.inputDeviceIds, ...context.outputDeviceIds]) {
    const ruleKey = DEVICE_RULE_KEY_BY_ID[deviceId];
    if (ruleKey) {
      incrementCount(componentCounts, ruleKey);
    }
  }

  const issues = [
    ...collectMissingCounts(activity.rule.requiredInputDevices, inputDeviceCounts, 'Input device list missing'),
    ...collectMissingCounts(activity.rule.requiredOutputDevices, outputDeviceCounts, 'Output device list missing'),
    ...collectMissingCounts(activity.rule.requiredComponents, componentCounts, 'Required components missing'),
  ];

  if (activity.rule.minWires && context.wires.length < activity.rule.minWires) {
    issues.push(`Add at least ${activity.rule.minWires} wire connection(s).`);
  }

  issues.push(...evaluateCustomConnections(activity.rule.customConnections, context.wires));

  if (!issues.length) {
    return {
      passed: true,
      feedback: 'Correct setup. Activity passed.',
      issues: [],
    };
  }

  return {
    passed: false,
    feedback: issues.join('\n'),
    issues,
  };
};
