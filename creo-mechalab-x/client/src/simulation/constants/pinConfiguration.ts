type RelayPortLike = {
    desc: string;
};

type RelayTerminalIds = Readonly<{
    terminal14: string;
    terminal13: string;
    terminal1: string;
    terminal2: string;
    terminal3: string;
    terminal4: string;
    terminal5: string;
    terminal6: string;
    terminal7: string;
    terminal8: string;
    terminal9: string;
    terminal10: string;
    terminal11: string;
    terminal12: string;
}>;

const createIndexedPinDescriptions = (prefix: string, descriptions: string[]): Record<string, string> =>
    Object.fromEntries(descriptions.map((desc, index) => [`${prefix}_${index + 1}`, desc]));

const createIndexedPinIds = <T extends string>(prefix: string, keyPrefix: T, count: number) =>
    Object.fromEntries(
        Array.from({ length: count }, (_, index) => [`${keyPrefix}${index + 1}`, `${prefix}_${index + 1}`]),
    ) as Record<`${T}${number}`, string>;

const createPinIdAliases = <T extends Record<string, number>>(prefix: string, aliases: T) =>
    Object.fromEntries(
        Object.entries(aliases).map(([alias, index]) => [alias, `${prefix}_${index}`]),
    ) as { [K in keyof T]: string };

const createRelayTerminalIds = (prefix: 'relay1' | 'relay2' | 'relay3' | 'relay4'): RelayTerminalIds => ({
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
const relay1PinIds = createRelayTerminalIds('relay1');
const relay2PinIds = createRelayTerminalIds('relay2');
const relay3PinIds = createRelayTerminalIds('relay3');
const relay4PinIds = createRelayTerminalIds('relay4');
const SOLENOID1_PIN_DESCRIPTIONS = [
    'A+ +',
    'A+ -',
    '',
    'A- +',
    'A- -',
    '',
    'LS1 - COM',
    'LS1 - NO',
    'LS1 - NC',
    'LS2 - COM',
    'LS2 - NO',
    'LS2 - NC',
] as const;

const SOLENOID2_PIN_DESCRIPTIONS = [
    'B+ +',
    'B+ -',
    '',
    'B- +',
    'B- -',
    '',
    'LS3 - COM',
    'LS3 - NO',
    'LS3 - NC',
    'LS4 - COM',
    'LS4 - NO',
    'LS4 - NC',
] as const;

const solenoid1PinIds = {
    ...createIndexedPinIds('solenoid1', 'terminal', SOLENOID1_PIN_DESCRIPTIONS.length),
    ...createPinIdAliases('solenoid1', {
        aPlusPositive: 1,
        aPlusNegative: 2,
        aMinusPositive: 4,
        aMinusNegative: 5,
        ls1Com: 7,
        ls1No: 8,
        ls1Nc: 9,
        ls2Com: 10,
        ls2No: 11,
        ls2Nc: 12,
    }),
} as const;

const solenoid2PinIds = {
    ...createIndexedPinIds('solenoid2', 'terminal', SOLENOID2_PIN_DESCRIPTIONS.length),
    ...createPinIdAliases('solenoid2', {
        bPlusPositive: 1,
        bPlusNegative: 2,
        bMinusPositive: 4,
        bMinusNegative: 5,
        ls3Com: 7,
        ls3No: 8,
        ls3Nc: 9,
        ls4Com: 10,
        ls4No: 11,
        ls4Nc: 12,
    }),
} as const;

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
    relay1: relay1PinIds,
    relay2: relay2PinIds,
    relay3: relay3PinIds,
    relay4: relay4PinIds,
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
    ...createIndexedPinDescriptions('relay4', ['14', '13', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']),
    ...createIndexedPinDescriptions('button', ['PB1-23', 'PB1-24', 'PB2-23', 'PB2-24', 'PB3-11', 'PB3-12', 'PB4-11', 'PB4-12', 'ESTOP-11', 'ESTOP-12', '', '']),
    ...createIndexedPinDescriptions('counter', ['1', '2', '3', '4', '5', '6', '7', '8', '', '', '', '']),
    ...createIndexedPinDescriptions('timer', ['1', '2', '3', '4', '5', '6', '7', '8', '', '', '', '']),
    ...createIndexedPinDescriptions('solenoid1', [...SOLENOID1_PIN_DESCRIPTIONS]),
    ...createIndexedPinDescriptions('solenoid2', [...SOLENOID2_PIN_DESCRIPTIONS]),
};

export const applyRelayPinConfiguration = (ports: Record<string, RelayPortLike>) => {
    Object.entries(RELAY_PIN_DESCRIPTIONS).forEach(([portId, desc]) => {
        const port = ports[portId];
        if (port) {
            port.desc = desc;
        }
    });
};
