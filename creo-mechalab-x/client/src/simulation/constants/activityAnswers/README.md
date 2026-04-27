# Activity Authoring Guide

This folder stores the answer definitions used by the simulation checker.
Use this guide when editing existing activities or creating new ones.

## Where Things Live

- `types.ts` defines the schema (`ActivityAnswerDefinition`, `ActivityCustomConnection`, etc.).
- `M1/` and `M5/` contain activity files grouped by module.
- `index.ts` registers all activity files and exposes lookup helpers used by the simulation runtime.
- `../../pinConfiguration.ts` exposes stable pin IDs (`RELAY_PIN_IDS`) used in activity rules.
- `../../utils/evaluateActivityAnswer.ts` validates devices and wire connections against your rules.
- `M1/COMMENT_DOCUMENTATION.md` is the module-specific comment guide for M1 activities.
- `M5/COMMENT_DOCUMENTATION.md` is the module-specific comment guide for M5 activities.

## Minimal Activity Template

```ts
import activityDiagram from '../../../../assets/ladder-diagrams/M5activity-5.1.png';
import type { ActivityAnswerDefinition, ActivityConnectionPair } from '../types';
import { RELAY_PIN_IDS } from '../../pinConfiguration';

const VPLUS_PINS = Object.values(RELAY_PIN_IDS.vplus);
const VMINUS_PINS = Object.values(RELAY_PIN_IDS.vminus);

const connectToAny = (sourcePin: string, targetPins: string[]): ActivityConnectionPair[] =>
  targetPins.map((targetPin) => [sourcePin, targetPin] as ActivityConnectionPair);

export const activityAnswer: ActivityAnswerDefinition = {
  routeId: '5.6',
  title: 'Example Activity',
  instruction: 'Describe what trainee must wire and expected runtime behavior.',
  diagram: activityDiagram,
  rule: {
    requiredInputDevices: { button: 1, limitSwitch: 1 },
    requiredOutputDevices: { relayModule: 1, solenoidValve: 1 },
    requiredComponents: { button: 1, limitSwitch: 1, relayModule: 1, solenoidValve: 1 },
    minWires: 6,
    customConnections: [
      connectToAny(RELAY_PIN_IDS.button.pb1Terminal23, VPLUS_PINS),
      [RELAY_PIN_IDS.button.pb1Terminal24, RELAY_PIN_IDS.relay1.terminal14],
    ],
  },
};
```

## Connection Rule Syntax (Important)

`ActivityCustomConnection` accepts either:

1. A single connection pair:

```ts
[pinA, pinB]
```

2. An OR-group (any one of these can satisfy this requirement):

```ts
[
  [pinA, pinB],
  [pinC, pinD],
]
```

3. Any-of power rail helper:

```ts
connectToAny(sourcePin, VPLUS_PINS)
```

4. Any-of helper plus extra specific option:

```ts
[
  ...connectToAny(sourcePin, VPLUS_PINS),
  [sourcePin, someOtherPin],
]
```

## Common Mistakes To Avoid

1. Do not use parentheses for pairs.

Wrong:

```ts
(pinA, pinB)
```

Correct:

```ts
[pinA, pinB]
```

2. Do not nest `connectToAny(...)` as one item inside an OR-group.

Wrong:

```ts
[
  connectToAny(sourcePin, VPLUS_PINS),
  [sourcePin, relayPin],
]
```

Correct:

```ts
[
  ...connectToAny(sourcePin, VPLUS_PINS),
  [sourcePin, relayPin],
]
```

3. Use `RELAY_PIN_IDS` only. Avoid hard-coded pin strings like `"relay1_3"`.

## Device Keys

### UI device IDs (drag/drop)

Use these exact IDs in runtime-facing mappings:

- `push-button`
- `buzzer`
- `counter`
- `light-indicator`
- `magnetic-contactor`
- `relay-module`
- `limit-switch`
- `solenoid-valve`
- `timer`

### Rule keys used in activity definitions

Use these exact keys in `requiredInputDevices`, `requiredOutputDevices`, `requiredComponents`:

- `button`
- `buzzer`
- `counter`
- `lightIndicator`
- `magneticMotorContactor`
- `relayModule`
- `limitSwitch`
- `solenoidValve`
- `timer`

Built-in components currently counted by evaluator:

- `battery`
- `relayModule`
- `lightIndicator`
- `buzzer`
- `counter`
- `solenoidValve`

## Solenoid Alias Meaning (M5)

Use this mapping consistently in comments and documentation:

- `aPlusPositive` = `A+ extend`
- `aPlusNegative` = `A+ retract`
- `aMinusPositive` = `A- extend`
- `aMinusNegative` = `A- retract`
- `bPlusPositive` = `B+ extend`
- `bPlusNegative` = `B+ retract`
- `bMinusPositive` = `B- extend`
- `bMinusNegative` = `B- retract`

When these aliases are used in `customConnections`, add an inline note on that exact line.

Example:

```ts
[RELAY_PIN_IDS.relay1.terminal6, RELAY_PIN_IDS.solenoid1.aPlusPositive], // A+ extend point
connectToAny(RELAY_PIN_IDS.solenoid1.aPlusNegative, VMINUS_PINS), // A+ retract point
```

## Adding A New Activity

1. Create a new file in the correct module folder (`M1` or `M5`), e.g. `activity-6.ts`.
2. Export one `ActivityAnswerDefinition` object from that file.
3. Import and register it in `index.ts`.
4. Ensure `routeId` follows your module route sequence and does not collide with existing IDs.
5. Add/verify ladder diagram asset path.
6. Validate with:

```bash
npm run lint
npm run build
```

## Simulation Light Activation Logic (SimulationApp)

When authoring activities, remember that lights are not controlled only by wire rules.
They are also controlled by runtime button logic in `SimulationApp.tsx`.

Important: in the current runtime, pressing `emergency-stop` does not change lamp state for Activities 1-5.

### Shared Gate Conditions

Most activity lamp outputs require all of these to be true:

- Module runtime is legacy M1 (`isLegacyM1Runtime`)
- Current `routeId` matches the activity
- Main switch is ON (`isMainSwitchOn`)
- M1 validation/completion gate is true (`isM1CheckCompleted = Boolean(isSessionCompleted || answerFeedback?.passed)`)

Core lamp state computation:

```ts
const isM1Activity1Route = isLegacyM1Runtime && activityPreset.routeId === '1';
const isM1CheckCompleted = Boolean(isSessionCompleted || answerFeedback?.passed);

const isActivity1GreenLampOn = isM1Activity1Route && isMainSwitchOn && isM1CheckCompleted && isActivity1GreenLampLatched;
const isActivity2GreenLampOn = isLegacyM1Runtime && activityPreset.routeId === '2' && isMainSwitchOn && isM1CheckCompleted && activity2LampMode === 'green';
const isActivity2RedLampOn = isLegacyM1Runtime && activityPreset.routeId === '2' && isMainSwitchOn && isM1CheckCompleted && activity2LampMode === 'red';
const isActivity3GreenLampOn = isLegacyM1Runtime && activityPreset.routeId === '3' && isMainSwitchOn && isM1CheckCompleted && activity3LampMode === 'green';
const isActivity3YellowLampOn = isLegacyM1Runtime && activityPreset.routeId === '3' && isMainSwitchOn && isM1CheckCompleted && activity3LampMode === 'yellow';
const isActivity4GreenLampOn = isLegacyM1Runtime && activityPreset.routeId === '4' && isMainSwitchOn && isM1CheckCompleted && activity4LampMode === 'green';
const isActivity4YellowLampOn = isLegacyM1Runtime && activityPreset.routeId === '4' && isMainSwitchOn && isM1CheckCompleted && activity4LampMode === 'yellow';
const isActivity5GreenLampOn = isLegacyM1Runtime && activityPreset.routeId === '5' && isMainSwitchOn && isM1CheckCompleted && activity5TimerStatus === 'done';
const isActivity5YellowLampOn = isLegacyM1Runtime && activityPreset.routeId === '5' && isMainSwitchOn && isM1CheckCompleted && activity5TimerStatus !== 'done';
```

Main switch side-effects:

- Turning main switch OFF resets Activity 1 latch, Activity 2/3/4 modes, and Activity 5 timer/relay runtime.
- Turning main switch ON auto-initializes Activity 3 lamp mode to yellow.

### Activity 1 (Start/Stop)

Current behavior in code:

- Press `start-1` with valid setup and main switch ON: green lamp latches ON.
- Press `stop-1`: green lamp unlatches OFF.
- Press `emergency-stop`: no lamp change.
- Red lamp is not used in Activity 1 by default.

```ts
if (activityPreset.routeId === '1' && buttonId === 'stop-1') {
  setIsActivity1GreenLampLatched(false);
  return;
}

if (buttonId !== 'start-1' || !isMainSwitchOn) return;

if (activityPreset.routeId === '1' && isCurrentSetupValid) {
  setIsActivity1GreenLampLatched(true);
}
```

If you want Activity 1 to turn red ON when STOP is pressed, you must add a dedicated Activity 1 lamp mode state and matching lamp-output condition (similar to Activity 2).

### Activity 2

- `start-1` sets lamp mode to green.
- `stop-1` sets lamp mode to red (only when setup is valid and main switch is ON).
- `emergency-stop` does nothing for Activity 2.

```ts
if (activityPreset.routeId === '2') {
  if (buttonId === 'stop-1') {
    setActivity2LampMode(isMainSwitchOn && isCurrentSetupValid ? 'red' : 'off');
    return;
  }
  if (buttonId === 'start-1' && isMainSwitchOn && isCurrentSetupValid) {
    setActivity2LampMode('green');
  }
  return;
}
```

### Activity 3

- Main switch ON initializes Activity 3 to yellow.
- `start-1` -> green
- `start-2` -> yellow
- `stop-1` or `stop-2` -> off
- `emergency-stop` does nothing for Activity 3.

### Activity 4

- `start-1` or `start-2` -> green
- `stop-1` -> yellow (or off if main switch is OFF / setup invalid)
- `emergency-stop` does nothing for Activity 4.

### Activity 5 (Timer)

- `start-1` (with main switch ON and valid setup) energizes relay and starts timer only when status is `idle`.
- Green lamp ON only when timer status is `done`.
- Yellow lamp ON whenever timer status is not `done` (`idle` or `timing`), as long as shared gates are true.
- `stop-1` resets timer runtime (relay off, status `idle`, remaining time cleared).
- `emergency-stop` does nothing for Activity 5.

## Quick Review Checklist

- Rule object has all required device counts.
- Every tuple uses square brackets.
- Every OR-group is an array of tuples.
- `connectToAny(...)` is spread when mixed with explicit options.
- All pins come from `RELAY_PIN_IDS`.
- Activity is registered in `index.ts`.
- Lint/build pass.
