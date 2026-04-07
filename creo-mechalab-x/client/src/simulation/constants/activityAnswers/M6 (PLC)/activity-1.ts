import type { ActivityAnswerDefinition } from '../types';
import { createM6ActivityAnswer, PLC_PIN_IDS } from '../../../config/plcDefaultPin';

export const activity1Answer: ActivityAnswerDefinition = createM6ActivityAnswer({
    routeId: '6.1',
    title: 'PLC Buzzer Basic Wiring',
    instruction: 'Create a simple buzzer circuit by connecting 24V_1 to buzzer plus, and buzzer minus to 0V_1.',
    rule: {
        minWires: 2,
        customConnections: [
            [PLC_PIN_IDS.source24v, PLC_PIN_IDS.buzzerPlus],
            [PLC_PIN_IDS.buzzerMinus, PLC_PIN_IDS.return0v],
        ],
    },
});