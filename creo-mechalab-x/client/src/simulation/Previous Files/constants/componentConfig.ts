export interface PinConfig {
  id: string;
  x: number;
  y: number;
}

export interface ComponentAsset {
  name: string;
  imageUrl: string;
  width: number;
  height: number;
  pins: PinConfig[];
}

export const COMPONENT_LIBRARY: Record<string, ComponentAsset> = {
  BATTERY_9V: {
    name: '9V Battery',
    imageUrl: '/assets/9vBattery.png', // Ensure this exists in your assets folder
    width: 80,
    height: 120,
    pins: [
      { id: 'pos', x: 25, y: 15 },
      { id: 'neg', x: 55, y: 15 },
    ],
  },
};