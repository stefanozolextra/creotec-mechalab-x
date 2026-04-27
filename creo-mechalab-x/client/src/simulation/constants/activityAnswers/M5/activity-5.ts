import activity55Diagram from '../../../../assets/ladder-diagrams/M5/activity-5.5.png';
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
  routeId: '5.5',
  title: 'A+ A- B+ B-',
  instruction: 'Follow the ladder diagram, place the required devices, and complete the electrical wiring for the two-cylinder A+ A- B+ B- sequence. With the main switch on, START-1 should latch R1 to drive A+, LS2 should hand off to R2 for A-, LS1 should hand off to B+, LS4 should hand off to R3 for B-, and LS3 should complete the finish/reset step through R4.',
  diagram: activity55Diagram,
  rule: {
    // PPTX answer slide shows 1 push-button unit, 4 limit switches, 4 relays, and 2 solenoid valves.
    // The terminals themselves remain available on the static board.
    requiredInputDevices: { button: 1, limitSwitch: 4 },
    requiredOutputDevices: { relayModule: 4, solenoidValve: 2 },
    requiredComponents: { button: 1, limitSwitch: 4, relayModule: 4, solenoidValve: 2 },
    minWires: 7,
    // These are the expected connections from the ladder diagram.
    // Button mapping: PB1/PB2 = START-1/START-2, PB3/PB4 = STOP-1/STOP-2.
    customConnections: [
      // START-1 (PB1) and STOP-1 (PB3) latch relay 1.
      connectToAny(RELAY_PIN_IDS.button.pb1Terminal23, VPLUS_PINS),
      [RELAY_PIN_IDS.button.pb1Terminal24, RELAY_PIN_IDS.button.pb3Terminal11],
      [RELAY_PIN_IDS.button.pb3Terminal12, RELAY_PIN_IDS.relay1.terminal14],
      connectToAny(RELAY_PIN_IDS.relay1.terminal13, VMINUS_PINS),
      connectToAny(RELAY_PIN_IDS.relay1.terminal9, VPLUS_PINS),
      [
        [RELAY_PIN_IDS.button.pb1Terminal24, RELAY_PIN_IDS.relay1.terminal5],
        [RELAY_PIN_IDS.button.pb3Terminal11, RELAY_PIN_IDS.relay1.terminal5],
      ],

      // R1 drives A+ through the relay 2 normally closed contact.
      connectToAny(RELAY_PIN_IDS.relay1.terminal10, VPLUS_PINS),
      [RELAY_PIN_IDS.relay1.terminal6, RELAY_PIN_IDS.relay2.terminal9],
      [RELAY_PIN_IDS.relay2.terminal1, RELAY_PIN_IDS.solenoid1.aPlusPositive], // A+ extend point
      connectToAny(RELAY_PIN_IDS.solenoid1.aPlusNegative, VMINUS_PINS), // A+ return

      // LS2 energizes relay 2, with relay 4 blocking further cycles until the sequence completes.
      connectToAny(RELAY_PIN_IDS.relay1.terminal11, VPLUS_PINS),
      [RELAY_PIN_IDS.relay1.terminal7, RELAY_PIN_IDS.relay4.terminal9],
      [RELAY_PIN_IDS.relay4.terminal1, RELAY_PIN_IDS.solenoid1.ls2Com],
      [RELAY_PIN_IDS.solenoid1.ls2No, RELAY_PIN_IDS.relay2.terminal14],
      connectToAny(RELAY_PIN_IDS.relay2.terminal13, VMINUS_PINS),
      [
        [RELAY_PIN_IDS.relay2.terminal10, RELAY_PIN_IDS.relay4.terminal1],
        [RELAY_PIN_IDS.relay2.terminal10, RELAY_PIN_IDS.solenoid1.ls2Com],
      ],
      [
        [RELAY_PIN_IDS.relay2.terminal6, RELAY_PIN_IDS.solenoid1.ls2No],
        [RELAY_PIN_IDS.relay2.terminal6, RELAY_PIN_IDS.relay2.terminal14],
      ],

      // Relay 2 drives A- through the relay 3 normally closed contact.
      connectToAny(RELAY_PIN_IDS.relay2.terminal11, VPLUS_PINS),
      [RELAY_PIN_IDS.relay2.terminal7, RELAY_PIN_IDS.relay3.terminal9],
      [RELAY_PIN_IDS.relay3.terminal1, RELAY_PIN_IDS.solenoid1.aMinusPositive], // A- extend point
      connectToAny(RELAY_PIN_IDS.solenoid1.aMinusNegative, VMINUS_PINS), // A- return

      // LS1 hands off from A- into B+.
      [
        [RELAY_PIN_IDS.solenoid1.ls1Com, RELAY_PIN_IDS.relay3.terminal1],
        [RELAY_PIN_IDS.solenoid1.ls1Com, RELAY_PIN_IDS.solenoid1.aMinusPositive],
      ],
      [RELAY_PIN_IDS.solenoid1.ls1No, RELAY_PIN_IDS.solenoid2.bPlusPositive], // B+ extend point
      connectToAny(RELAY_PIN_IDS.solenoid2.bPlusNegative, VMINUS_PINS), // B+ return

      // LS4 energizes relay 3, with relay 4's second contact gating the branch.
      connectToAny(RELAY_PIN_IDS.relay2.terminal12, VPLUS_PINS),
      [RELAY_PIN_IDS.relay2.terminal8, RELAY_PIN_IDS.relay4.terminal10],
      [RELAY_PIN_IDS.relay4.terminal2, RELAY_PIN_IDS.solenoid2.ls4Com],
      [RELAY_PIN_IDS.solenoid2.ls4No, RELAY_PIN_IDS.relay3.terminal14],
      connectToAny(RELAY_PIN_IDS.relay3.terminal13, VMINUS_PINS),
      [
        [RELAY_PIN_IDS.relay3.terminal10, RELAY_PIN_IDS.relay4.terminal2],
        [RELAY_PIN_IDS.relay3.terminal10, RELAY_PIN_IDS.solenoid2.ls4Com],
      ],
      [
        [RELAY_PIN_IDS.relay3.terminal6, RELAY_PIN_IDS.solenoid2.ls4No],
        [RELAY_PIN_IDS.relay3.terminal6, RELAY_PIN_IDS.relay3.terminal14],
      ],

      // Relay 3 drives B-.
      connectToAny(RELAY_PIN_IDS.relay3.terminal11, VPLUS_PINS),
      [RELAY_PIN_IDS.relay3.terminal7, RELAY_PIN_IDS.solenoid2.bMinusPositive], // B- extend point
      connectToAny(RELAY_PIN_IDS.solenoid2.bMinusNegative, VMINUS_PINS), // B- return

      // LS3 completes the sequence by energizing relay 4.
      [
        [RELAY_PIN_IDS.solenoid2.ls3Com, RELAY_PIN_IDS.relay3.terminal7],
        [RELAY_PIN_IDS.solenoid2.ls3Com, RELAY_PIN_IDS.solenoid2.bMinusPositive],
      ],
      [RELAY_PIN_IDS.solenoid2.ls3No, RELAY_PIN_IDS.relay4.terminal14],
      connectToAny(RELAY_PIN_IDS.relay4.terminal13, VMINUS_PINS),
    ],
  },
};
