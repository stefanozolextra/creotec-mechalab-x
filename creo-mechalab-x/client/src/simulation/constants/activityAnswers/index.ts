import { activity1Answer as m1Activity1Answer } from './M2/activity-1';
import { activity2Answer as m1Activity2Answer } from './M2/activity-2';
import { activity3Answer as m1Activity3Answer } from './M2/activity-3';
import { activity4Answer as m1Activity4Answer } from './M2/activity-4';
import { activity5Answer as m1Activity5Answer } from './M2/activity-5';
import { activityAnswer as m5Activity1Answer } from './M5/activity-1';
import { activityAnswer as m5Activity2Answer } from './M5/activity-2';
import { activityAnswer as m5Activity3Answer } from './M5/activity-3';
import { activityAnswer as m5Activity4Answer } from './M5/activity-4';
import { activityAnswer as m5Activity5Answer } from './M5/activity-5';
import { activity1Answer as m6Activity1Answer } from './M6 (PLC)/activity-1';
import { activity2Answer as m6Activity2Answer } from './M6 (PLC)/activity-2';
import { activity3Answer as m6Activity3Answer } from './M6 (PLC)/activity-3';
import { activity4Answer as m6Activity4Answer } from './M6 (PLC)/activity-4';
import { activity5Answer as m6Activity5Answer } from './M6 (PLC)/activity-5';
import type { ActivityAnswerDefinition } from './types';
import {
  DEFAULT_ACTIVITY_MODULE_ID,
  normalizeActivityModuleId,
} from '../../utils/activityState';

const createActivityAnswerMap = (
  answers: ActivityAnswerDefinition[],
): Record<string, ActivityAnswerDefinition> =>
  Object.fromEntries(answers.map((answer) => [answer.routeId, answer]));

const M1_ACTIVITY_ANSWERS = createActivityAnswerMap([
  m1Activity1Answer,
  m1Activity2Answer,
  m1Activity3Answer,
  m1Activity4Answer,
  m1Activity5Answer,
]);

const M5_ACTIVITY_ANSWERS = createActivityAnswerMap([
  m5Activity1Answer,
  m5Activity2Answer,
  m5Activity3Answer,
  m5Activity4Answer,
  m5Activity5Answer,
]);

const M6_ACTIVITY_ANSWERS = createActivityAnswerMap([
  m6Activity1Answer,
  m6Activity2Answer,
  m6Activity3Answer,
  m6Activity4Answer,
  m6Activity5Answer,
]);

const inferActivityModuleIdFromRouteId = (routeId?: string): number | null => {
  const normalizedRouteId = routeId?.trim();
  if (!normalizedRouteId) return null;
  if (normalizedRouteId.startsWith('5.')) return 5;
  if (normalizedRouteId.startsWith('6.')) return 6;
  return null;
};

export const ACTIVITY_ANSWER_PACKS: Record<number, Record<string, ActivityAnswerDefinition>> = {
  [DEFAULT_ACTIVITY_MODULE_ID]: M1_ACTIVITY_ANSWERS,
  5: M5_ACTIVITY_ANSWERS,
  6: M6_ACTIVITY_ANSWERS,
};

export const ACTIVITY_ANSWERS = ACTIVITY_ANSWER_PACKS[DEFAULT_ACTIVITY_MODULE_ID];
export const DEFAULT_ACTIVITY_ANSWER = m1Activity1Answer;

export const getActivityAnswersForModule = (moduleId?: number | null): Record<string, ActivityAnswerDefinition> => {
  const normalizedModuleId = normalizeActivityModuleId(moduleId);
  return ACTIVITY_ANSWER_PACKS[normalizedModuleId ?? DEFAULT_ACTIVITY_MODULE_ID]
    ?? ACTIVITY_ANSWER_PACKS[DEFAULT_ACTIVITY_MODULE_ID];
};

export const getActivityRouteIds = (moduleId?: number | null): string[] =>
  Object.keys(getActivityAnswersForModule(moduleId));

export const getActivityAnswerByRouteId = (
  routeId?: string,
  moduleId?: number | null,
): ActivityAnswerDefinition => {
  const answers = getActivityAnswersForModule(
    inferActivityModuleIdFromRouteId(routeId) ?? normalizeActivityModuleId(moduleId),
  );
  return routeId ? (answers[routeId] ?? DEFAULT_ACTIVITY_ANSWER) : DEFAULT_ACTIVITY_ANSWER;
};

export type { ActivityAnswerDefinition };
