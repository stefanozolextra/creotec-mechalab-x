import activity5Diagram from '../../../../assets/ladder-diagrams/M5/activity-5.5.png';
import { RELAY_PIN_IDS } from '../../pinConfiguration';
import type { ActivityAnswerDefinition } from '../types';
import {
  START_STOP_LATCH_CONNECTIONS,
  connectToGround,
  connectToGroundOrBus,
  connectToSupply,
} from './shared';

export const activity5Answer: ActivityAnswerDefinition = {
  routeId: '5',
  title: 'Four-Relay Sequence A+ A- B+ B-',
  instruction: 'Wire the full four-relay electro-pneumatic sequence so the cylinders advance and return in the order shown on the ladder diagram using LS1 to LS4 as the transfer signals.',
  diagram: activity5Diagram,
  rule: {
    requiredInputDevices: { button: 1, rollerLever: 1 },
    requiredOutputDevices: { relayModule: 1, solenoidValve: 1 },
    requiredComponents: { battery: 1, relayModule: 1, solenoidValve: 2 },
    minWires: 36,
    customConnections: [
      ...START_STOP_LATCH_CONNECTIONS,
      connectToSupply(RELAY_PIN_IDS.relay1.terminal10),
      [RELAY_PIN_IDS.relay1.terminal6, RELAY_PIN_IDS.relay2.terminal9],
      [RELAY_PIN_IDS.relay2.terminal1, RELAY_PIN_IDS.solenoid1.aPlusPositive],
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
      [RELAY_PIN_IDS.relay1.terminal7, RELAY_PIN_IDS.relay4.terminal9],
      [RELAY_PIN_IDS.relay4.terminal1, RELAY_PIN_IDS.solenoid1.ls2Com],
      [RELAY_PIN_IDS.solenoid1.ls2No, RELAY_PIN_IDS.relay2.terminal14],
      connectToGround(RELAY_PIN_IDS.relay2.terminal13),
      [
        [RELAY_PIN_IDS.relay4.terminal1, RELAY_PIN_IDS.relay2.terminal10],
        [RELAY_PIN_IDS.solenoid1.ls2Com, RELAY_PIN_IDS.relay2.terminal10],
      ],
      [
        [RELAY_PIN_IDS.relay2.terminal6, RELAY_PIN_IDS.solenoid1.ls2No],
        [RELAY_PIN_IDS.relay2.terminal6, RELAY_PIN_IDS.relay2.terminal14],
      ],
      connectToSupply(RELAY_PIN_IDS.relay2.terminal11),
      [RELAY_PIN_IDS.relay2.terminal7, RELAY_PIN_IDS.relay3.terminal9],
      [RELAY_PIN_IDS.relay3.terminal1, RELAY_PIN_IDS.solenoid1.aMinusPositive],
      [
        [RELAY_PIN_IDS.relay3.terminal1, RELAY_PIN_IDS.solenoid1.ls1Com],
        [RELAY_PIN_IDS.solenoid1.aMinusPositive, RELAY_PIN_IDS.solenoid1.ls1Com],
      ],
      [RELAY_PIN_IDS.solenoid1.ls1No, RELAY_PIN_IDS.solenoid2.bPlusPositive],
      connectToSupply(RELAY_PIN_IDS.relay2.terminal12),
      [RELAY_PIN_IDS.relay2.terminal8, RELAY_PIN_IDS.relay4.terminal10],
      [RELAY_PIN_IDS.relay4.terminal2, RELAY_PIN_IDS.solenoid2.ls4Com],
      [RELAY_PIN_IDS.solenoid2.ls4No, RELAY_PIN_IDS.relay3.terminal14],
      connectToGround(RELAY_PIN_IDS.relay3.terminal13),
      [
        [RELAY_PIN_IDS.relay4.terminal2, RELAY_PIN_IDS.relay3.terminal10],
        [RELAY_PIN_IDS.solenoid2.ls4Com, RELAY_PIN_IDS.relay3.terminal10],
      ],
      [
        [RELAY_PIN_IDS.relay3.terminal6, RELAY_PIN_IDS.solenoid2.ls4No],
        [RELAY_PIN_IDS.relay3.terminal6, RELAY_PIN_IDS.relay3.terminal14],
      ],
      connectToSupply(RELAY_PIN_IDS.relay3.terminal11),
      [RELAY_PIN_IDS.relay3.terminal7, RELAY_PIN_IDS.solenoid2.bMinusPositive],
      [
        [RELAY_PIN_IDS.relay3.terminal7, RELAY_PIN_IDS.solenoid2.ls3Com],
        [RELAY_PIN_IDS.solenoid2.bMinusPositive, RELAY_PIN_IDS.solenoid2.ls3Com],
      ],
      [RELAY_PIN_IDS.solenoid2.ls3No, RELAY_PIN_IDS.relay4.terminal14],
      connectToGround(RELAY_PIN_IDS.relay4.terminal13),
    ],
  },
};
