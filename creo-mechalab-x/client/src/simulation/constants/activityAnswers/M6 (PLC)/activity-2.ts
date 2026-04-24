import type { ActivityAnswerDefinition } from '../types';
import { createM6ActivityAnswer } from '../../../config/plcDefaultPin';

export const activity2Answer: ActivityAnswerDefinition = createM6ActivityAnswer({
    routeId: '6.2',
    title: 'PLC Activity 2: PLC Input and Output Wiring',
    instruction: 'TODO: Final PLC wiring requirements for Activity 2 are still pending. This route is registered so Module 6 no longer falls back to Module 1, but verification remains disabled until the final trainer reference is provided.',
    isPlaceholder: true,
    rule: {},
});
