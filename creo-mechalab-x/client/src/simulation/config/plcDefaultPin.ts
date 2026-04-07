import type {
    ActivityAnswerDefinition,
    ActivityConnectionPair,
    ActivityRuleDefinition,
} from '../constants/activityAnswers/types';
import { GOTT_TRAINER_PORTS } from './plcPinConfiguration';

export type PlcPinId = keyof typeof GOTT_TRAINER_PORTS;

export type PlcPinIds = {
    source24v: PlcPinId;
    buzzerPlus: PlcPinId;
    buzzerMinus: PlcPinId;
    return0v: PlcPinId;
};

export const PLC_PIN_IDS: PlcPinIds = {
    source24v: '24v_1',
    buzzerPlus: 'buzzer_plus',
    buzzerMinus: 'buzzer_minus',
    return0v: '0v_1',
};

export const DEFAULT_M6_RULE: ActivityRuleDefinition = {
    requiredInputDevices: {},
    requiredOutputDevices: {},
    requiredComponents: {},
    minWires: 0,
    customConnections: [],
};

export const createM6ActivityAnswer = (
    config: Omit<ActivityAnswerDefinition, 'diagram' | 'rule'> & {
        diagram?: string;
        rule?: Partial<ActivityRuleDefinition>;
    },
): ActivityAnswerDefinition => ({
    ...config,
    diagram: config.diagram ?? '',
    rule: {
        ...DEFAULT_M6_RULE,
        ...config.rule,
    },
});

export const connectToAnyPlc = (
    sourcePin: PlcPinId,
    targetPins: PlcPinId[],
): ActivityConnectionPair[] => targetPins.map((targetPin) => [sourcePin, targetPin]);
