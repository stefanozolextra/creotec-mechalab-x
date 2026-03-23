type RelayPortLike = {
    desc: string;
};

const createIndexedPinDescriptions = (prefix: string, descriptions: string[]): Record<string, string> =>
    Object.fromEntries(descriptions.map((desc, index) => [`${prefix}_${index + 1}`, desc]));

export const RELAY_PIN_DESCRIPTIONS: Record<string, string> = {
    ...createIndexedPinDescriptions('vplus', Array.from({ length: 12 }, (_, index) => `24V+ Supply ${index + 1}`)),
    ...createIndexedPinDescriptions('vminus', Array.from({ length: 12 }, (_, index) => `0V- Ground ${index + 1}`)),
    ...createIndexedPinDescriptions('lights', ['G - X1', 'G - X2', 'Y - X1', 'Y - X2', 'R - X1', 'R - X2', 'Buzzer +', 'Buzzer -', '', '', '', '',]),
    ...createIndexedPinDescriptions('relay1', ['14', '13', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']),
    ...createIndexedPinDescriptions('relay2', ['14', '13', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']),
    ...createIndexedPinDescriptions('relay3', ['14', '13', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']),
    ...createIndexedPinDescriptions('button', Array.from({ length: 12 }, (_, index) => `Relay 1 (Bot) ${index + 1}`)),
    ...createIndexedPinDescriptions('counter', Array.from({ length: 12 }, (_, index) => `Relay 2 (Bot) ${index + 1}`)),
    ...createIndexedPinDescriptions('timer', Array.from({ length: 12 }, (_, index) => `Timer/Ctr (Bot) ${index + 1}`)),
    ...createIndexedPinDescriptions('solenoid1', Array.from({ length: 12 }, (_, index) => `Solenoid 1 ${index + 1}`)),
    ...createIndexedPinDescriptions('solenoid2', Array.from({ length: 12 }, (_, index) => `Solenoid 2 ${index + 1}`)),
};

export const applyRelayPinConfiguration = (ports: Record<string, RelayPortLike>) => {
    Object.entries(RELAY_PIN_DESCRIPTIONS).forEach(([portId, desc]) => {
        const port = ports[portId];
        if (port) {
            port.desc = desc;
        }
    });
};
