import activity2Diagram from '../../../../assets/ladder-diagrams/M5/activity-5.2.png';
import { RELAY_PIN_IDS } from '../../pinConfiguration';
import type { ActivityAnswerDefinition } from '../types';
import {
  START_STOP_LATCH_CONNECTIONS,
  connectToGround,
  connectToGroundOrBus,
  connectToSupply,
} from './shared';

export const activity2Answer: ActivityAnswerDefinition = {
  routeId: '2',
  title: 'Limit-Switch Solenoid Transfer',
  instruction: 'Wire the relay transfer circuit for cylinder A so LS2 hands control to the retract stage and LS1 resets the sequence through the auxiliary relays.',
  diagram: activity2Diagram,
  rule: {
    requiredInputDevices: { button: 1, rollerLever: 1 },
    requiredOutputDevices: { relayModule: 1, solenoidValve: 1 },
    requiredComponents: { battery: 1, relayModule: 1, solenoidValve: 1 },
    minWires: 22,
    customConnections: [
      ...START_STOP_LATCH_CONNECTIONS,
      connectToSupply(RELAY_PIN_IDS.relay1.terminal10),
      [RELAY_PIN_IDS.relay1.terminal6, RELAY_PIN_IDS.relay2.terminal10],
      [RELAY_PIN_IDS.relay2.terminal2, RELAY_PIN_IDS.solenoid1.aPlusPositive],
      connectToGroundOrBus(RELAY_PIN_IDS.solenoid1.aPlusNegative, [
        RELAY_PIN_IDS.solenoid1.aMinusNegative,
      ]),
      [
        [RELAY_PIN_IDS.relay1.terminal6, RELAY_PIN_IDS.solenoid1.ls2Com],
        [RELAY_PIN_IDS.relay2.terminal10, RELAY_PIN_IDS.solenoid1.ls2Com],
      ],
      [RELAY_PIN_IDS.solenoid1.ls2No, RELAY_PIN_IDS.relay3.terminal10],
      [RELAY_PIN_IDS.relay3.terminal2, RELAY_PIN_IDS.relay2.terminal14],
      connectToGround(RELAY_PIN_IDS.relay2.terminal13),
      [
        [RELAY_PIN_IDS.relay2.terminal9, RELAY_PIN_IDS.relay1.terminal6],
        [RELAY_PIN_IDS.relay2.terminal9, RELAY_PIN_IDS.relay2.terminal10],
        [RELAY_PIN_IDS.relay2.terminal9, RELAY_PIN_IDS.solenoid1.ls2Com],
      ],
      [
        [RELAY_PIN_IDS.relay2.terminal5, RELAY_PIN_IDS.solenoid1.ls2No],
        [RELAY_PIN_IDS.relay2.terminal5, RELAY_PIN_IDS.relay3.terminal10],
      ],
      connectToSupply(RELAY_PIN_IDS.relay2.terminal11),
      [RELAY_PIN_IDS.relay2.terminal7, RELAY_PIN_IDS.solenoid1.aMinusPositive],
      connectToGroundOrBus(RELAY_PIN_IDS.solenoid1.aMinusNegative, [
        RELAY_PIN_IDS.solenoid1.aPlusNegative,
      ]),
      [
        [RELAY_PIN_IDS.relay2.terminal7, RELAY_PIN_IDS.solenoid1.ls1Com],
        [RELAY_PIN_IDS.solenoid1.aMinusPositive, RELAY_PIN_IDS.solenoid1.ls1Com],
      ],
      [RELAY_PIN_IDS.solenoid1.ls1No, RELAY_PIN_IDS.relay3.terminal14],
      connectToGround(RELAY_PIN_IDS.relay3.terminal13),
    ],
  },
};
