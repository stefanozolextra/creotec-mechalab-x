const m6LadderProgramModules = import.meta.glob('../../../../assets/ladder-diagrams/M6/*.png', {
    eager: true,
    import: 'default',
}) as Record<string, string>;

export const getM6LadderProgramDiagram = (routeId: string): string =>
    m6LadderProgramModules[`../../../../assets/ladder-diagrams/M6/activity-${routeId}.png`] ?? '';
