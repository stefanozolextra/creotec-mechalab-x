import buttonDevice from '../../assets/devices/button.png';
import limitSwitchDevice from '../../assets/devices/limit-switch.png';
import magneticContactorDevice from '../../assets/devices/magnetic-motor-contactor.png';
import relayModuleDevice from '../../assets/devices/relay-module.png';
import solenoidValveDevice from '../../assets/devices/solenoid-valve.png';

export type PlcDeviceZone = 'input' | 'output';

const optionalPlcDeviceImages = import.meta.glob('../../assets/devices/plc/*.png', {
    eager: true,
    import: 'default',
}) as Record<string, string>;

const magneticReedSwitchSensorDevice =
    optionalPlcDeviceImages['../../assets/devices/plc/magnetic-reed-switch-sensor.png'] ?? limitSwitchDevice;
const plcModuleDevice =
    optionalPlcDeviceImages['../../assets/devices/plc/plc-module.png'] ?? relayModuleDevice;

export interface PlcDeviceLibraryItemDefinition {
    id: string;
    label: string;
    category: string;
    description: string;
    image: string;
    zones: readonly PlcDeviceZone[];
    expectedAssetPath?: string;
}

export const PLC_DEVICE_LIBRARY = [
    {
        id: 'plc-module',
        label: 'PLC Module',
        category: 'Output',
        description: 'PLC controller module used as the central control unit for trainer wiring.',
        image: plcModuleDevice,
        zones: ['output'],
        expectedAssetPath: 'client/src/assets/devices/plc/plc-module.png',
    },
    {
        id: 'relay-module',
        label: 'Relay Module',
        category: 'Output',
        description: 'Relay module used for PLC output switching and control circuits.',
        image: relayModuleDevice,
        zones: ['output'],
    },
    {
        id: 'push-button',
        label: 'Push Button',
        category: 'Input',
        description: 'Momentary command input for start, jog, or manual PLC signals.',
        image: buttonDevice,
        zones: ['input'],
    },
    {
        id: 'solenoid-valve',
        label: 'Solenoid Valve',
        category: 'Output',
        description: 'Pneumatic actuator valve output controlled by PLC wiring.',
        image: solenoidValveDevice,
        zones: ['output'],
    },
    {
        id: 'limit-switch',
        label: 'Limit Switch',
        category: 'Input',
        description: 'Mechanical position input used as a PLC sequence condition.',
        image: limitSwitchDevice,
        zones: ['input'],
    },
    {
        id: 'magnetic-contactor',
        label: 'Magnetic Contactor',
        category: 'Output',
        description: 'Magnetic contactor used for motor or load control outputs.',
        image: magneticContactorDevice,
        zones: ['output'],
    },
    {
        id: 'magnetic-reed-switch-sensor',
        label: 'Magnetic Reed Switch Sensor',
        category: 'Input',
        description: 'Cylinder-mounted magnetic reed sensor used as a PLC input signal.',
        image: magneticReedSwitchSensorDevice,
        zones: ['input'],
        expectedAssetPath: 'client/src/assets/devices/plc/magnetic-reed-switch-sensor.png',
    },
] as const satisfies readonly PlcDeviceLibraryItemDefinition[];

export type PlcDeviceLibraryItem = (typeof PLC_DEVICE_LIBRARY)[number];
export type PlcDeviceId = (typeof PLC_DEVICE_LIBRARY)[number]['id'];
