export const SIMULATION_COMPONENT_TYPES = [
  'battery',
  'led',
  'resistor',
  'switch',
  'button',
  'buzzer',
  'counter',
  'lightIndicator',
  'magneticMotorContactor',
  'relayModule',
  'limitSwitch',
  'solenoidValve',
] as const;

export type SimulationComponentType = (typeof SIMULATION_COMPONENT_TYPES)[number];

export const getPinMeta = (pinId: string) => {
  const parts = pinId.split('-');
  const pinName = parts.pop() ?? '';
  const componentId = parts.join('-');
  return { pinName, componentId };
};

export const inferPaletteTypeFromComponentId = (componentId: string): SimulationComponentType | null => {
  const aliasMap: Record<string, SimulationComponentType> = {
    magneticMotor: 'magneticMotorContactor',
    magneticMotorContactor: 'magneticMotorContactor',
  };

  for (const [alias, mapped] of Object.entries(aliasMap)) {
    if (componentId.startsWith(alias)) return mapped;
  }

  for (const type of SIMULATION_COMPONENT_TYPES) {
    if (componentId.startsWith(type)) return type;
  }

  return null;
};

export default {
  SIMULATION_COMPONENT_TYPES,
  getPinMeta,
  inferPaletteTypeFromComponentId,
};
