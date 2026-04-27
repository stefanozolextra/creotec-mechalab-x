import { RELAY_PIN_IDS } from '../../pinConfiguration';
import type { ActivityConnectionPair, ActivityCustomConnection } from '../types';

export const VPLUS_PINS = Object.values(RELAY_PIN_IDS.vplus);
export const VMINUS_PINS = Object.values(RELAY_PIN_IDS.vminus);

export const connectToAny = (sourcePin: string, targetPins: string[]): ActivityConnectionPair[] =>
  targetPins.map((targetPin) => [sourcePin, targetPin] as ActivityConnectionPair);

export const connectToSupply = (sourcePin: string): ActivityConnectionPair[] =>
  connectToAny(sourcePin, VPLUS_PINS);

export const connectToGround = (sourcePin: string): ActivityConnectionPair[] =>
  connectToAny(sourcePin, VMINUS_PINS);

export const connectToGroundOrBus = (
  sourcePin: string,
  siblingBusPins: string[],
): ActivityConnectionPair[] => [
  ...connectToGround(sourcePin),
  ...siblingBusPins.map((targetPin) => [sourcePin, targetPin] as ActivityConnectionPair),
];

export const START_STOP_LATCH_CONNECTIONS: ActivityCustomConnection[] = [
  connectToSupply(RELAY_PIN_IDS.button.pb1Terminal23),
  [RELAY_PIN_IDS.button.pb1Terminal24, RELAY_PIN_IDS.button.pb3Terminal11],
  [RELAY_PIN_IDS.button.pb3Terminal12, RELAY_PIN_IDS.relay1.terminal14],
  connectToGround(RELAY_PIN_IDS.relay1.terminal13),
  connectToSupply(RELAY_PIN_IDS.relay1.terminal9),
  [
    [RELAY_PIN_IDS.relay1.terminal5, RELAY_PIN_IDS.button.pb1Terminal24],
    [RELAY_PIN_IDS.relay1.terminal5, RELAY_PIN_IDS.button.pb3Terminal11],
  ],
];
