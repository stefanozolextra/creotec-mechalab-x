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
  wrongConnections: Array<{ fromPin: string; toPin: string }>;
}

interface ResolvedConnectionOption {
  originalFromPin: string;
  originalToPin: string;
  resolvedFromPin: string;
  resolvedToPin: string;
}

interface ResolvedCustomConnections {
  issues: string[];
  requirements: ResolvedConnectionOption[][];
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
  timer: 'timer',
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
  [/^relay4_(\d+)$/, 'relay4_top_$1'],
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

const describePin = (pinId: string) => {
  const pin = RELAY_PORTS[pinId];
  const label = pin?.desc?.trim() || pin?.label?.trim();
  return label ? `${pinId} (${label})` : pinId;
};

const isAlternativeConnectionGroup = (
  connection: ActivityCustomConnection,
): connection is ActivityConnectionPair[] => Array.isArray(connection[0]);

const resolveCustomConnections = (
  customConnections: ActivityCustomConnection[] | undefined,
): ResolvedCustomConnections => {
  if (!customConnections?.length) {
    return { issues: [], requirements: [] };
  }

  const issues: string[] = [];
  const requirements: ResolvedConnectionOption[][] = [];

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

    requirements.push(
      resolvedOptions.map((option) => ({
        originalFromPin: option.originalFromPin,
        originalToPin: option.originalToPin,
        resolvedFromPin: option.resolvedFromPin!,
        resolvedToPin: option.resolvedToPin!,
      })),
    );
  }

  return { issues, requirements };
};

const canSatisfyRequirementsWithDistinctWires = (
  requirements: ResolvedConnectionOption[][],
  wireSet: Set<string>,
) => {
  const requirementKeys = requirements
    .map((requirement) => Array.from(
      new Set(
        requirement
          .map((option) => toWireKey(option.resolvedFromPin, option.resolvedToPin))
          .filter((key) => wireSet.has(key)),
      ),
    ))
    .sort((left, right) => left.length - right.length);

  const usedKeys = new Set<string>();

  const matchRequirement = (requirementIndex: number): boolean => {
    if (requirementIndex >= requirementKeys.length) {
      return true;
    }

    for (const key of requirementKeys[requirementIndex]) {
      if (usedKeys.has(key)) continue;

      usedKeys.add(key);
      if (matchRequirement(requirementIndex + 1)) {
        return true;
      }
      usedKeys.delete(key);
    }

    return false;
  };

  return matchRequirement(0);
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
  const resolvedCustomConnections = resolveCustomConnections(activity.rule.customConnections);
  issues.push(...resolvedCustomConnections.issues);

  if (activity.rule.minWires && context.wires.length < activity.rule.minWires) {
    issues.push(`Add at least ${activity.rule.minWires} wire connection(s).`);
  }

  const normalizedWires = context.wires.flatMap((wire) => {
    const resolvedFromPin = resolvePortId(wire.fromPin);
    const resolvedToPin = resolvePortId(wire.toPin);
    if (!resolvedFromPin || !resolvedToPin) return [];

    return [{
      fromPin: wire.fromPin,
      toPin: wire.toPin,
      resolvedFromPin,
      resolvedToPin,
      key: toWireKey(resolvedFromPin, resolvedToPin),
    }];
  });
  const wireSet = new Set(normalizedWires.map((wire) => wire.key));

  for (const requirement of resolvedCustomConnections.requirements) {
    const hasMatchingConnection = requirement.some((option) =>
      wireSet.has(toWireKey(option.resolvedFromPin, option.resolvedToPin)),
    );

    if (hasMatchingConnection) continue;

    if (requirement.length === 1) {
      const [option] = requirement;
      issues.push(`Missing required connection: ${option.originalFromPin} <-> ${option.originalToPin}`);
      continue;
    }

    const labels = requirement
      .map((option) => `${option.originalFromPin} <-> ${option.originalToPin}`)
      .join(' OR ');
    issues.push(`Missing one required connection option: ${labels}`);
  }

  const hasDistinctWireAssignment = canSatisfyRequirementsWithDistinctWires(
    resolvedCustomConnections.requirements,
    wireSet,
  );
  const hasAllRequirementsIndividuallyMatched = resolvedCustomConnections.requirements.every(
    (requirement) => requirement.some((option) =>
      wireSet.has(toWireKey(option.resolvedFromPin, option.resolvedToPin))),
  );

  if (
    resolvedCustomConnections.requirements.length
    && hasAllRequirementsIndividuallyMatched
    && !hasDistinctWireAssignment
  ) {
    issues.push('Add distinct wire connections to satisfy all required paths.');
  }

  const validConnectionKeys = new Set(
    resolvedCustomConnections.requirements.flatMap((requirement) =>
      requirement.map((option) => toWireKey(option.resolvedFromPin, option.resolvedToPin)),
    ),
  );
  const answerPins = new Set(
    resolvedCustomConnections.requirements.flatMap((requirement) =>
      requirement.flatMap((option) => [option.resolvedFromPin, option.resolvedToPin]),
    ),
  );
  const hasCompleteConnectionMap = Boolean(
    activity.rule.customConnections?.length &&
    (!activity.rule.minWires || activity.rule.customConnections.length >= activity.rule.minWires),
  );
  const wrongConnections = normalizedWires
    .filter((wire) => {
      if (validConnectionKeys.has(wire.key)) return false;
      return hasCompleteConnectionMap
        || answerPins.has(wire.resolvedFromPin)
        || answerPins.has(wire.resolvedToPin);
    })
    .map(({ fromPin, toPin }) => ({ fromPin, toPin }));

  issues.push(
    ...wrongConnections.map(
      ({ fromPin, toPin }) =>
        `Wrong connection: ${describePin(fromPin)} <-> ${describePin(toPin)}`,
    ),
  );

  if (!issues.length) {
    return {
      passed: true,
      feedback: 'Correct setup. Activity passed.',
      issues: [],
      wrongConnections: [],
    };
  }

  return {
    passed: false,
    feedback: issues.join('\n'),
    issues,
    wrongConnections,
  };
};
