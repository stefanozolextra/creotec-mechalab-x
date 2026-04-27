import type { ActivityAnswerDefinition } from '../types';
import { createM6ActivityAnswer } from '../../../config/plcDefaultPin';
import { getM6LadderProgramDiagram } from './diagrams';

export const activity5Answer: ActivityAnswerDefinition = createM6ActivityAnswer({
    routeId: '6.5',
    title: 'PLC Activity 5: PLC Sequence Control',
    instruction: 'TODO: Final PLC wiring requirements for Activity 5 are still pending. This route is registered so Module 6 no longer falls back to Module 1, but verification remains disabled until the final trainer reference is provided.',
    diagram: getM6LadderProgramDiagram('6.5'),
    isPlaceholder: true,
    rule: {},
});
