type RelayPortLike = {
    desc: string;
};

const createIndexedPinDescriptions = (prefix: string, descriptions: string[]): Record<string, string> =>
    Object.fromEntries(descriptions.map((desc, index) => [`${prefix}_${index + 1}`, desc]));

const createIndexedPinIds = <T extends string>(prefix: string, keyPrefix: T, count: number) =>
    Object.fromEntries(
        Array.from({ length: count }, (_, index) => [`${keyPrefix}${index + 1}`, `${prefix}_${index + 1}`]),
    ) as Record<`${T}${number}`, string>;

const createRelayTerminalIds = (prefix: 'relay1' | 'relay2' | 'relay3') => ({
    terminal14: `${prefix}_1`,
    terminal13: `${prefix}_2`,
    terminal1: `${prefix}_3`,
    terminal2: `${prefix}_4`,
    terminal3: `${prefix}_5`,
    terminal4: `${prefix}_6`,
    terminal5: `${prefix}_7`,
    terminal6: `${prefix}_8`,
    terminal7: `${prefix}_9`,
    terminal8: `${prefix}_10`,
    terminal9: `${prefix}_11`,
    terminal10: `${prefix}_12`,
    terminal11: `${prefix}_13`,
    terminal12: `${prefix}_14`,
} as const);

const counterPinIds = createIndexedPinIds('counter', 'terminal', 12);
const timerPinIds = createIndexedPinIds('timer', 'terminal', 12);
const solenoid1PinIds = createIndexedPinIds('solenoid1', 'terminal', 12);
const solenoid2PinIds = createIndexedPinIds('solenoid2', 'terminal', 12);

export const RELAY_PIN_IDS = {
    vplus: createIndexedPinIds('vplus', 'supply', 12),
    vminus: createIndexedPinIds('vminus', 'ground', 12),
    lights: {
        greenX1: 'lights_1',
        greenX2: 'lights_2',
        yellowX1: 'lights_3',
        yellowX2: 'lights_4',
        redX1: 'lights_5',
        redX2: 'lights_6',
        buzzerPositive: 'lights_7',
        buzzerNegative: 'lights_8',
    },
    relay1: createRelayTerminalIds('relay1'),
    relay2: createRelayTerminalIds('relay2'),
    relay3: createRelayTerminalIds('relay3'),
    counter: counterPinIds,
    counter1: counterPinIds,
    timer: timerPinIds,
    timer1: timerPinIds,
    solenoid1: solenoid1PinIds,
    solenoid2: solenoid2PinIds,
    button: {
        pb1Terminal23: 'button_1',
        pb1Terminal24: 'button_2',
        pb2Terminal23: 'button_3',
        pb2Terminal24: 'button_4',
        pb3Terminal11: 'button_5',
        pb3Terminal12: 'button_6',
        pb4Terminal11: 'button_7',
        pb4Terminal12: 'button_8',
        estopTerminal11: 'button_9',
        estopTerminal12: 'button_10',
        spare11: 'button_11',
        spare12: 'button_12',
    },
} as const;

export const RELAY_PIN_DESCRIPTIONS: Record<string, string> = {
    ...createIndexedPinDescriptions('vplus', Array.from({ length: 12 }, (_, index) => `24V+ Supply ${index + 1}`)),
    ...createIndexedPinDescriptions('vminus', Array.from({ length: 12 }, (_, index) => `0V- Ground ${index + 1}`)),
    ...createIndexedPinDescriptions('lights', ['G - X1', 'G - X2', 'Y - X1', 'Y - X2', 'R - X1', 'R - X2', 'Buzzer +', 'Buzzer -', '', '', '', '',]),
    ...createIndexedPinDescriptions('relay1', ['14', '13', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']),
    ...createIndexedPinDescriptions('relay2', ['14', '13', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']),
    ...createIndexedPinDescriptions('relay3', ['14', '13', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']),
    ...createIndexedPinDescriptions('button', ['PB1-23', 'PB1-24', 'PB2-23', 'PB2-24', 'PB3-11', 'PB3-12', 'PB4-11', 'PB4-12', 'ESTOP-11', 'ESTOP-12', '', '']),
    ...createIndexedPinDescriptions('counter', ['1', '2', '3', '4', '5', '6', '7', '8', '', '', '', '']),
    ...createIndexedPinDescriptions('timer', ['1', '2', '3', '4', '5', '6', '7', '8', '', '', '', '']),
    ...createIndexedPinDescriptions('solenoid1', ['A+ +', 'A+ -', '', 'A- +', 'A- -', '', 'LS1 - COM', 'LS1 - NO', 'LS1 - NC', 'LS2 - COM', 'LS2 - NO', 'LS2 - NC', '', '']),
    ...createIndexedPinDescriptions('solenoid2', ['B+ +', 'B+ -', '', 'B- +', 'B- -', '', 'LS3 - COM', 'LS3 - NO', 'LS3 - NC', 'LS4 - COM', 'LS4 - NO', 'LS4 - NC', '', '']),
};

export const applyRelayPinConfiguration = (ports: Record<string, RelayPortLike>) => {
    Object.entries(RELAY_PIN_DESCRIPTIONS).forEach(([portId, desc]) => {
        const port = ports[portId];
        if (port) {
            port.desc = desc;
        }
    });
};
