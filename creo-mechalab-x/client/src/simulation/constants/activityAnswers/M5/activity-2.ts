import activity52Diagram from '../../../../assets/ladder-diagrams/M5/activity-5.2.png';
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
  routeId: '5.2',
  title: 'A+ A-',
  instruction: 'Follow the ladder diagram, place the required devices, and complete the wiring path for the start-stop control circuit. With the main switch on, pressing START-1 should turn the green light on and keep it on until STOP-1 is pressed.',
  diagram: activity52Diagram,
  rule: {
    requiredInputDevices: { button: 1, limitSwitch: 2 },
    requiredOutputDevices: { relayModule: 3, solenoidValve: 1 },
    requiredComponents: { button: 1, limitSwitch: 2, relayModule: 3, solenoidValve: 1 },
    minWires: 7,
    // Other wiring combinations may work, but these are the expected paths from the diagram.
    // Button mapping: PB1/PB2 = START-1/START-2, PB3/PB4 = STOP-1/STOP-2.
    customConnections: [
      // START-1 (PB1) and STOP-1 (PB3) path that controls relay 1.
      connectToAny(RELAY_PIN_IDS.button.pb1Terminal23, VPLUS_PINS),
      [RELAY_PIN_IDS.button.pb1Terminal24, RELAY_PIN_IDS.button.pb3Terminal11],
      [RELAY_PIN_IDS.button.pb3Terminal12, RELAY_PIN_IDS.relay1.terminal14],
      connectToAny(RELAY_PIN_IDS.relay1.terminal13, VMINUS_PINS),
      // Power feed for relay 1 from any 24V+ terminal.
      connectToAny(RELAY_PIN_IDS.relay1.terminal9, VPLUS_PINS),

      // Relay 1 terminal 5 can receive power from START-1 output (PB1-24) or STOP-1 input side (PB3-11).
      [
        (RELAY_PIN_IDS.button.pb1Terminal24, RELAY_PIN_IDS.relay1.terminal5),
        (RELAY_PIN_IDS.button.pb3Terminal11, RELAY_PIN_IDS.relay1.terminal5),
      ],
      // Relay output drives A+ solenoid line.
      connectToAny(RELAY_PIN_IDS.relay1.terminal10, VPLUS_PINS),
      [RELAY_PIN_IDS.relay1.terminal6, RELAY_PIN_IDS.relay2.terminal10],
      [RELAY_PIN_IDS.relay2.terminal2, RELAY_PIN_IDS.solenoid1.aPlusPositive], // A+ extend point
      // A+ return path.
      connectToAny(RELAY_PIN_IDS.solenoid1.aPlusNegative, VPLUS_PINS), // A+ retract point

      // LS2 COM can connect to either of these points.
      [
        (RELAY_PIN_IDS.solenoid1.ls2Com, RELAY_PIN_IDS.relay1.terminal6),
        (RELAY_PIN_IDS.solenoid1.ls2Com, RELAY_PIN_IDS.relay2.terminal10),
      ],

      // Relay 2 terminal 9 can use either branch.
      [
        (RELAY_PIN_IDS.relay2.terminal9, RELAY_PIN_IDS.relay1.terminal6),
        (RELAY_PIN_IDS.relay2.terminal9, RELAY_PIN_IDS.relay2.terminal10),
      ],

      // Hand-off to the next step in the sequence (via LS2 and relay 3).
      [RELAY_PIN_IDS.solenoid1.ls2No, RELAY_PIN_IDS.relay3.terminal10],
      [RELAY_PIN_IDS.relay3.terminal2, RELAY_PIN_IDS.relay2.terminal14],
      connectToAny(RELAY_PIN_IDS.relay2.terminal13, VMINUS_PINS),

      // Relay 2 branch that supports A- movement.
      [
        (RELAY_PIN_IDS.relay2.terminal5, RELAY_PIN_IDS.solenoid1.ls2No),
        (RELAY_PIN_IDS.relay2.terminal5, RELAY_PIN_IDS.relay3.terminal10),
      ],
      connectToAny(RELAY_PIN_IDS.relay2.terminal11, VPLUS_PINS),
      [RELAY_PIN_IDS.relay2.terminal7, RELAY_PIN_IDS.solenoid1.aMinusPositive], // A- extend point
      // A- return path and LS1 feedback path.
      connectToAny(RELAY_PIN_IDS.solenoid1.aMinusNegative, VMINUS_PINS), // A- retract point
      [
        (RELAY_PIN_IDS.solenoid1.ls1Com, RELAY_PIN_IDS.relay2.terminal7),
        (RELAY_PIN_IDS.solenoid1.ls1Com, RELAY_PIN_IDS.solenoid1.aMinusPositive), // A- extend feedback branch
      ],
      [RELAY_PIN_IDS.solenoid1.ls1No, RELAY_PIN_IDS.relay3.terminal14],
      connectToAny(RELAY_PIN_IDS.relay3.terminal13, VMINUS_PINS),
    ],
  },
};
