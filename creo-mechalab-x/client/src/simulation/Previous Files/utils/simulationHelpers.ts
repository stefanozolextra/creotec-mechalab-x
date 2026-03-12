export const getPinMeta = (pinId: string) => {
  const parts = pinId.split('-');
  const pinName = parts.pop() ?? '';
  const componentId = parts.join('-');
  return { pinName, componentId };
};

export const inferPaletteTypeFromComponentId = (componentId: string, simulationComponentTypes: string[]) => {
  const aliasMap: Record<string, string> = { magneticMotor: 'magneticMotorContactor' };
  for (const [alias, mapped] of Object.entries(aliasMap)) {
    if (componentId.startsWith(alias)) return mapped;
  }
  return simulationComponentTypes.find((type) => componentId.startsWith(type)) || null;
};

export default { getPinMeta, inferPaletteTypeFromComponentId };
