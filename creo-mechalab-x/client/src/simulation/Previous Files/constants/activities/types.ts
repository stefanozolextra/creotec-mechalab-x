export type ActivityDeviceType =
  | 'battery'
  | 'led'
  | 'resistor'
  | 'switch'
  | 'button'
  | 'buzzer'
  | 'counter'
  | 'lightIndicator'
  | 'magneticMotorContactor'
  | 'relayModule'
  | 'rollerLever'
  | 'solenoidValve';

export interface ActivityValidationContext {
  componentCounts: Record<ActivityDeviceType, number>;
  inputDeviceCounts: Record<ActivityDeviceType, number>;
  outputDeviceCounts: Record<ActivityDeviceType, number>;
  wireCount: number;
  switchOnCount: number;
  litLedCount: number;
}

export interface ActivityRule {
  requiredComponents?: Partial<Record<ActivityDeviceType, number>>;
  requiredInputDevices?: Partial<Record<ActivityDeviceType, number>>;
  requiredOutputDevices?: Partial<Record<ActivityDeviceType, number>>;
  minWires?: number;
  minSwitchOn?: number;
  minLitLed?: number;
  customConnections?: Array<[string, string] | Array<[string, string]>>;
  customConnectionOptions?: Array<Array<[string, string]>>;
}

export interface SimulationActivity {
  id: string;
  title: string;
  instructions?: string[];
  instructionImageSrc?: string;
  rule: ActivityRule;
}

export interface ActivityEvaluationResult {
  passed: boolean;
  feedback: string;
}
