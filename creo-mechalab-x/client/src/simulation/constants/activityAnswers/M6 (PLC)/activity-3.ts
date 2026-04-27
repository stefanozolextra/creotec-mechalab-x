import type { ActivityAnswerDefinition } from '../types';
import { createM6ActivityAnswer } from '../../../config/plcDefaultPin';
import { getM6LadderProgramDiagram } from './diagrams';

export const activity3Answer: ActivityAnswerDefinition = createM6ActivityAnswer({
    routeId: '6.3',
    title: 'PLC Activity 3: PLC Motor Control',
    instruction: 'TODO: Final PLC wiring requirements for Activity 3 are still pending. This route is registered so Module 6 no longer falls back to Module 1, but verification remains disabled until the final trainer reference is provided.',
    diagram: getM6LadderProgramDiagram('6.3'),
    isPlaceholder: true,
    rule: {},
});
