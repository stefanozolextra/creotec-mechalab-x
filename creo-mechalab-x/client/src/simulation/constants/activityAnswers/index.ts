import { activity1Answer } from './activity-1';
import { activity2Answer } from './activity-2';
import type { ActivityAnswerDefinition } from './types';

export const ACTIVITY_ANSWERS: Record<string, ActivityAnswerDefinition> = {
  [activity1Answer.routeId]: activity1Answer,
  [activity2Answer.routeId]: activity2Answer,
};

export const DEFAULT_ACTIVITY_ANSWER = activity1Answer;

export const getActivityAnswerByRouteId = (routeId?: string): ActivityAnswerDefinition =>
  (routeId && ACTIVITY_ANSWERS[routeId]) ?? DEFAULT_ACTIVITY_ANSWER;

export type { ActivityAnswerDefinition };
