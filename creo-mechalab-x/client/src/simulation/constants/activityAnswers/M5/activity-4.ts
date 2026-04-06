import activity4Diagram from '../../../../assets/ladder-diagrams/M5/activity-5.4.png';
import { RELAY_PIN_IDS } from '../../pinConfiguration';
import type { ActivityAnswerDefinition } from '../types';
import {
  START_STOP_LATCH_CONNECTIONS,
  connectToGround,
  connectToGroundOrBus,
  connectToSupply,
} from './shared';

export const activity4Answer: ActivityAnswerDefinition = {
  routeId: '4',
  title: 'Two-Cylinder Sequence A+ B+ B- A-',
  instruction: 'Follow the relay interlock diagram so cylinder A extends first, cylinder B follows, then the return path is completed in the B- to A- order.',
  diagram: activity4Diagram,
  rule: {
    requiredInputDevices: { button: 1, rollerLever: 1 },
    requiredOutputDevices: { relayModule: 1, solenoidValve: 1 },
    requiredComponents: { battery: 1, relayModule: 1, solenoidValve: 2 },
    minWires: 30,
    customConnections: [
      ...START_STOP_LATCH_CONNECTIONS,
      connectToSupply(RELAY_PIN_IDS.relay1.terminal10),
      [RELAY_PIN_IDS.relay1.terminal6, RELAY_PIN_IDS.relay2.terminal9],
      [RELAY_PIN_IDS.relay2.terminal1, RELAY_PIN_IDS.solenoid1.aPlusPositive],
      [
        [RELAY_PIN_IDS.relay2.terminal1, RELAY_PIN_IDS.solenoid1.ls2Com],
        [RELAY_PIN_IDS.solenoid1.aPlusPositive, RELAY_PIN_IDS.solenoid1.ls2Com],
      ],
      [RELAY_PIN_IDS.solenoid1.ls2No, RELAY_PIN_IDS.solenoid2.bPlusPositive],
      connectToGroundOrBus(RELAY_PIN_IDS.solenoid1.aPlusNegative, [
        RELAY_PIN_IDS.solenoid1.aMinusNegative,
      ]),
      connectToGroundOrBus(RELAY_PIN_IDS.solenoid1.aMinusNegative, [
        RELAY_PIN_IDS.solenoid1.aPlusNegative,
      ]),
      connectToGroundOrBus(RELAY_PIN_IDS.solenoid2.bPlusNegative, [
        RELAY_PIN_IDS.solenoid2.bMinusNegative,
      ]),
      connectToGroundOrBus(RELAY_PIN_IDS.solenoid2.bMinusNegative, [
        RELAY_PIN_IDS.solenoid2.bPlusNegative,
      ]),
      connectToSupply(RELAY_PIN_IDS.relay1.terminal11),
      [RELAY_PIN_IDS.relay1.terminal7, RELAY_PIN_IDS.solenoid2.ls4Com],
      [RELAY_PIN_IDS.solenoid2.ls4No, RELAY_PIN_IDS.relay3.terminal9],
      [RELAY_PIN_IDS.relay3.terminal1, RELAY_PIN_IDS.relay2.terminal14],
      connectToGround(RELAY_PIN_IDS.relay2.terminal13),
      [
        [RELAY_PIN_IDS.relay1.terminal7, RELAY_PIN_IDS.relay2.terminal10],
        [RELAY_PIN_IDS.solenoid2.ls4Com, RELAY_PIN_IDS.relay2.terminal10],
      ],
      [
        [RELAY_PIN_IDS.relay2.terminal6, RELAY_PIN_IDS.solenoid2.ls4No],
        [RELAY_PIN_IDS.relay2.terminal6, RELAY_PIN_IDS.relay3.terminal9],
      ],
      connectToSupply(RELAY_PIN_IDS.relay2.terminal11),
      [RELAY_PIN_IDS.relay2.terminal7, RELAY_PIN_IDS.solenoid2.bMinusPositive],
      [
        [RELAY_PIN_IDS.relay2.terminal7, RELAY_PIN_IDS.solenoid2.ls3Com],
        [RELAY_PIN_IDS.solenoid2.bMinusPositive, RELAY_PIN_IDS.solenoid2.ls3Com],
      ],
      [RELAY_PIN_IDS.solenoid2.ls3No, RELAY_PIN_IDS.solenoid1.aMinusPositive],
      connectToSupply(RELAY_PIN_IDS.relay2.terminal12),
      [RELAY_PIN_IDS.relay2.terminal8, RELAY_PIN_IDS.solenoid1.ls1Com],
      [RELAY_PIN_IDS.solenoid1.ls1No, RELAY_PIN_IDS.relay3.terminal14],
      connectToGround(RELAY_PIN_IDS.relay3.terminal13),
    ],
  },
};
