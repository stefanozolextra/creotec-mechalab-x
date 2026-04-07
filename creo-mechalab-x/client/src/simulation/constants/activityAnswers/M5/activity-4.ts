import activity54Diagram from '../../../../assets/ladder-diagrams/M5/activity-5.4.png';
import type { ActivityAnswerDefinition, ActivityConnectionPair } from '../types';
import { RELAY_PIN_IDS } from '../../pinConfiguration';

const VPLUS_PINS = Object.values(RELAY_PIN_IDS.vplus);
const VMINUS_PINS = Object.values(RELAY_PIN_IDS.vminus);

// Solenoid name guide used in M5 activities:
// aPlusPositive = A+ extend, aPlusNegative = A+ retract
// aMinusPositive = A- extend, aMinusNegative = A- retract
// bPlusPositive = B+ extend, bPlusNegative = B+ retract
// bMinusPositive = B- extend, bMinusNegative = B- retract

const connectToAny = (sourcePin: string, targetPins: string[]): ActivityConnectionPair[] =>
  targetPins.map((targetPin) => [sourcePin, targetPin] as ActivityConnectionPair);

export const activityAnswer: ActivityAnswerDefinition = {
  routeId: '5.4',
  title: 'A+ B+ B- A-',
  instruction: 'Follow the ladder diagram, place the required devices, and complete the wiring path for the start-stop control circuit. With the main switch on, pressing START-1 should turn the green light on and keep it on until STOP-1 is pressed.',
  diagram: activity54Diagram,
  rule: {
    requiredInputDevices: { button: 1 },
    requiredOutputDevices: { relayModule: 1, solenoidValve: 1 },
    requiredComponents: { battery: 1, relayModule: 1, solenoidValve: 1 },
    minWires: 7,
    // These are the expected connections from the diagram.
    // Button mapping: PB1/PB2 = START-1/START-2, PB3/PB4 = STOP-1/STOP-2.
    customConnections: [
      // These first lines are the START-1 (PB1) and STOP-1 (PB3) path for relay 1.
      connectToAny(RELAY_PIN_IDS.button.pb1Terminal23, VPLUS_PINS),
      [RELAY_PIN_IDS.button.pb1Terminal24, RELAY_PIN_IDS.button.pb3Terminal11],
      [RELAY_PIN_IDS.button.pb3Terminal12, RELAY_PIN_IDS.relay1.terminal14],
      connectToAny(RELAY_PIN_IDS.relay1.terminal13, VMINUS_PINS),
      connectToAny(RELAY_PIN_IDS.relay1.terminal9, VPLUS_PINS),
      // Relay 1 terminal 5 can receive power from START-1 output (PB1-24) or STOP-1 input side (PB3-11).
      [
        (RELAY_PIN_IDS.button.pb1Terminal24, RELAY_PIN_IDS.relay1.terminal5),
        (RELAY_PIN_IDS.button.pb3Terminal11, RELAY_PIN_IDS.relay1.terminal5),
      ],
      // These lines drive the A+ and A- paths.
      connectToAny(RELAY_PIN_IDS.relay1.terminal10, VPLUS_PINS),
      [RELAY_PIN_IDS.relay1.terminal6, RELAY_PIN_IDS.solenoid1.aPlusPositive], // A+ extend point
      connectToAny(RELAY_PIN_IDS.solenoid1.aPlusNegative, VMINUS_PINS), // A+ retract point
      connectToAny(RELAY_PIN_IDS.relay1.terminal11, VPLUS_PINS),
      [RELAY_PIN_IDS.relay1.terminal3, RELAY_PIN_IDS.solenoid1.aMinusPositive], // A- extend point
      connectToAny(RELAY_PIN_IDS.solenoid1.aMinusNegative, VMINUS_PINS), // A- retract point
    ],
  },
};
