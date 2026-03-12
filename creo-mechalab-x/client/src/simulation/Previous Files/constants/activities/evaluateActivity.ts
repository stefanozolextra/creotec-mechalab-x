import type { ActivityDeviceType, ActivityEvaluationResult, ActivityValidationContext, SimulationActivity } from './types';

const DEVICE_LABELS: Record<ActivityDeviceType, string> = {
  battery: 'Battery',
  led: 'LED',
  resistor: 'Resistor',
  switch: 'Switch',
  button: 'Push Button',
  buzzer: 'Buzzer',
  counter: 'Counter',
  lightIndicator: 'Light Indicator',
  magneticMotorContactor: 'Magnetic Contactor',
  relayModule: 'Relay Module',
  rollerLever: 'Roller Lever',
  solenoidValve: 'Solenoid Valve',
};

const describeMissing = (scope: string, entries: string[]) => `${scope}: ${entries.join(', ')}`;

const collectMissingCounts = (
  required: Partial<Record<ActivityDeviceType, number>>,
  actual: Record<ActivityDeviceType, number>,
) => Object.entries(required)
  .flatMap(([device, minimum]) => {
    if (!minimum) return [];
    const actualCount = actual[device as ActivityDeviceType] ?? 0;
    if (actualCount >= minimum) return [];
    return `${DEVICE_LABELS[device as ActivityDeviceType]} x${minimum}`;
  });

export const evaluateActivity = (
  activity: SimulationActivity,
  context: ActivityValidationContext & { wires?: Array<{ fromPin: string; toPin: string }> },
): ActivityEvaluationResult => {
  const issues: string[] = [];

  if (activity.rule.requiredComponents) {
    const missing = collectMissingCounts(activity.rule.requiredComponents, context.componentCounts);
    if (missing.length) {
      issues.push(describeMissing('Circuit components missing', missing));
    }
  }

  if (activity.rule.requiredInputDevices) {
    const missing = collectMissingCounts(activity.rule.requiredInputDevices, context.inputDeviceCounts);
    if (missing.length) {
      issues.push(describeMissing('Input device list missing', missing));
    }
  }

  if (activity.rule.requiredOutputDevices) {
    const missing = collectMissingCounts(activity.rule.requiredOutputDevices, context.outputDeviceCounts);
    if (missing.length) {
      issues.push(describeMissing('Output device list missing', missing));
    }
  }

  if (activity.rule.minWires && context.wireCount < activity.rule.minWires) {
    issues.push(`Add at least ${activity.rule.minWires} wire connection(s).`);
  }

  if (activity.rule.minSwitchOn && context.switchOnCount < activity.rule.minSwitchOn) {
    issues.push(`Turn ON at least ${activity.rule.minSwitchOn} switch(es).`);
  }

  if (activity.rule.minLitLed && context.litLedCount < activity.rule.minLitLed) {
    issues.push(`Light up at least ${activity.rule.minLitLed} LED(s).`);
  }

  // Custom connection validation for activity-1
  if (activity.id === 'activity-1' && activity.rule.customConnectionOptions && context.wires) {
    const wireSet = new Set(context.wires.map(w => `${w.fromPin}|${w.toPin}`));

    const optionSatisfied = activity.rule.customConnectionOptions.some((option) => (
      option.every(([a, b]) => {
        const key1 = `${a}|${b}`;
        const key2 = `${b}|${a}`;
        return wireSet.has(key1) || wireSet.has(key2);
      })
    ));

    if (!optionSatisfied) {
      issues.push('Required connection pattern not matched for Activity 1 (Option 1 / Option 2 / Option 3).');
    }
  } else if (activity.id === 'activity-1' && activity.rule.customConnections && context.wires) {
    const wireSet = new Set(context.wires.map(w => `${w.fromPin}|${w.toPin}`));
    for (const requirement of activity.rule.customConnections) {
      const options = Array.isArray(requirement[0])
        ? requirement as Array<[string, string]>
        : [requirement as [string, string]];

      const hasAnyOption = options.some(([a, b]) => {
        const key1 = `${a}|${b}`;
        const key2 = `${b}|${a}`;
        return wireSet.has(key1) || wireSet.has(key2);
      });

      if (!hasAnyOption) {
        if (options.length === 1) {
          const [a, b] = options[0];
          issues.push(`Missing required connection: ${a} ↔ ${b}`);
        } else {
          const labels = options.map(([a, b]) => `${a} ↔ ${b}`).join(' OR ');
          issues.push(`Missing one required connection option: ${labels}`);
        }
      }
    }
  }

  if (issues.length === 0) {
    return {
      passed: true,
      feedback: 'Correct setup. Activity passed.',
    };
  }

  return {
    passed: false,
    feedback: issues.join(' '),
  };
};
