export type ActivityConnectionPair = [string, string];
export type ActivityCustomConnection = ActivityConnectionPair | ActivityConnectionPair[];

export interface ActivityRuleDefinition {
  requiredInputDevices?: Record<string, number>;
  requiredOutputDevices?: Record<string, number>;
  requiredComponents?: Record<string, number>;
  minWires?: number;
  customConnections?: ActivityCustomConnection[];
}

export interface ActivityAnswerDefinition {
  routeId: string;
  title: string;
  diagram: string;
  rule: ActivityRuleDefinition;
}
