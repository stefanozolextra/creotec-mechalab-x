import activity1Diagram from '../../../../assets/ladder-diagrams/M1/activity-1.png';
import type { ActivityAnswerDefinition, ActivityConnectionPair } from '../types';
import { RELAY_PIN_IDS } from '../../pinConfiguration';

const VPLUS_PINS = Object.values(RELAY_PIN_IDS.vplus);
const VMINUS_PINS = Object.values(RELAY_PIN_IDS.vminus);

const connectToAny = (sourcePin: string, targetPins: string[]): ActivityConnectionPair[] =>
  targetPins.map((targetPin) => [sourcePin, targetPin] as ActivityConnectionPair);

export const activity1Answer: ActivityAnswerDefinition = {
  routeId: '1',
  title: 'Start-Stop Control Unit',
  instruction: 'Follow the ladder diagram, place the required devices, and complete the wiring path for the start-stop control circuit. With the main switch on, pressing START-1 should turn the green light on and keep it on until STOP-1 is pressed.',
  diagram: activity1Diagram,
  rule: {
    requiredInputDevices: { button: 1 },
    requiredOutputDevices: { relayModule: 1, lightIndicator: 1 },
    requiredComponents: { battery: 1, relayModule: 1, lightIndicator: 1 },
    minWires: 7,
    // different combination of connections can work, but these are the ones expected based on the diagram
    customConnections: [
      [RELAY_PIN_IDS.lights.greenX2, RELAY_PIN_IDS.relay1.terminal4],
      connectToAny(RELAY_PIN_IDS.lights.greenX1, VMINUS_PINS),
      connectToAny(RELAY_PIN_IDS.relay1.terminal13, VMINUS_PINS),
      connectToAny(RELAY_PIN_IDS.relay1.terminal7, VPLUS_PINS),
      connectToAny(RELAY_PIN_IDS.button.pb1Terminal23, VPLUS_PINS),
      [RELAY_PIN_IDS.button.pb1Terminal24, RELAY_PIN_IDS.button.pb3Terminal11],
      [RELAY_PIN_IDS.button.pb3Terminal12, RELAY_PIN_IDS.relay1.terminal14],
    ],
  },
};
