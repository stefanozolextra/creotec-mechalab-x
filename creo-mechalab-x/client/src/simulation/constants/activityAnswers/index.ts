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

export const ACTIVITY_ANSWER_PACKS: Record<number, Record<string, ActivityAnswerDefinition>> = {
  [DEFAULT_ACTIVITY_MODULE_ID]: M1_ACTIVITY_ANSWERS,
  5: M5_ACTIVITY_ANSWERS,
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
  const answers = getActivityAnswersForModule(moduleId);
  return routeId ? (answers[routeId] ?? DEFAULT_ACTIVITY_ANSWER) : DEFAULT_ACTIVITY_ANSWER;
};

export type { ActivityAnswerDefinition };
