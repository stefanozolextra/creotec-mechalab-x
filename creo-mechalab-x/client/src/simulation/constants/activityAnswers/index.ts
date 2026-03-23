import { activity1Answer } from './M1/activity-1';
import { activity2Answer } from './M1/activity-2';
import { activity3Answer } from './M1/activity-3';
import { activity4Answer } from './M1/activity-4';
import { activity5Answer } from './M1/activity-5';
import type { ActivityAnswerDefinition } from './types';

export const ACTIVITY_ANSWERS: Record<string, ActivityAnswerDefinition> = {
  [activity1Answer.routeId]: activity1Answer,
  [activity2Answer.routeId]: activity2Answer,
  [activity3Answer.routeId]: activity3Answer,
  [activity4Answer.routeId]: activity4Answer,
  [activity5Answer.routeId]: activity5Answer,
};

export const DEFAULT_ACTIVITY_ANSWER = activity1Answer;

export const getActivityAnswerByRouteId = (routeId?: string): ActivityAnswerDefinition =>
  (routeId && ACTIVITY_ANSWERS[routeId]) ?? DEFAULT_ACTIVITY_ANSWER;

export type { ActivityAnswerDefinition };
