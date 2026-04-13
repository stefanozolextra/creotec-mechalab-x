import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  FileQuestion,
  Loader2,
  RotateCcw,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import CyberTransition from '../components/CyberTransition';
import ReactAntiCapture from '../components/AntiCapture';
import {
  getModuleQuizAttempt,
  getModuleQuizResult,
  getModuleQuizSummary,
  saveModuleQuizAnswer,
  startOrResumeModuleQuiz,
  submitModuleQuiz,
} from '../api/traineeQuizzes';
import { useToast } from '../contexts/ToastContext';
import type {
  ModuleQuizAttemptResponse,
  TraineeQuizAttempt,
  TraineeQuizQuestion,
  TraineeQuizResult,
  TraineeQuizSavedAnswer,
  TraineeQuizSummary,
} from '../types/traineeQuiz';

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const toPositiveInt = (value: string | undefined): number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

const buildSavedAnswerMap = (savedAnswers: TraineeQuizSavedAnswer[]): Record<number, number> => {
  return savedAnswers.reduce<Record<number, number>>((accumulator, answer) => {
    accumulator[answer.question_id] = answer.selected_choice_id;
    return accumulator;
  }, {});
};

const formatDuration = (seconds: number): string => {
  const safeSeconds = Math.max(0, Number.isFinite(seconds) ? Math.floor(seconds) : 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

const formatSubmittedAt = (value: string | null): string => {
  if (!value) return 'Unavailable';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 'Unavailable';
  return new Date(timestamp).toLocaleString();
};

const ModuleQuizPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const toast = useToast();

  const moduleId = toPositiveInt(id);
  const hasValidModuleId = moduleId > 0;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [quizSummary, setQuizSummary] = useState<TraineeQuizSummary | null>(null);
  const [activeAttempt, setActiveAttempt] = useState<TraineeQuizAttempt | null>(null);
  const [questions, setQuestions] = useState<TraineeQuizQuestion[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<TraineeQuizResult | null>(null);
  const [countdownSeconds, setCountdownSeconds] = useState<number>(0);
  const [resumeNotice, setResumeNotice] = useState<string | null>(null);
  const [startBusy, setStartBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [refreshingResult, setRefreshingResult] = useState(false);
  const [pendingQuestionIds, setPendingQuestionIds] = useState<Record<number, boolean>>({});

  const activeAttemptId = activeAttempt?.attempt_id ?? null;
  const autoSubmitTriggeredRef = useRef(false);
  const requestControllerRef = useRef<AbortController | null>(null);

  const resetAttemptState = useCallback(() => {
    setActiveAttempt(null);
    setQuestions([]);
    setSelectedAnswers({});
    setCountdownSeconds(0);
    setPendingQuestionIds({});
  }, []);

  const applyAttemptResponse = useCallback((
    response: ModuleQuizAttemptResponse,
    options?: { notice?: string | null },
  ) => {
    setActionError(null);
    setQuizSummary(response.quiz);

    if (response.expired && response.result) {
      resetAttemptState();
      setResult(response.result);
      setResumeNotice(options?.notice ?? 'Time expired. Your saved answers were submitted automatically.');
      return;
    }

    if (!response.attempt) {
      resetAttemptState();
      setResult(response.result);
      setResumeNotice(options?.notice ?? null);
      return;
    }

    setActiveAttempt(response.attempt);
    setQuestions(response.questions);
    setSelectedAnswers(buildSavedAnswerMap(response.saved_answers));
    setCountdownSeconds(response.attempt.remaining_seconds);
    setResult(null);
    setResumeNotice(options?.notice ?? null);
  }, [resetAttemptState]);

  const loadResult = useCallback(async (options?: { signal?: AbortSignal }) => {
    if (!hasValidModuleId) return;

    const response = await getModuleQuizResult(moduleId, { signal: options?.signal });
    setActionError(null);
    setQuizSummary(response.quiz);
    resetAttemptState();
    setResult(response.result);
  }, [hasValidModuleId, moduleId, resetAttemptState]);

  const loadAttempt = useCallback(async (options?: { signal?: AbortSignal; notice?: string | null }) => {
    if (!hasValidModuleId) return;

    const response = await getModuleQuizAttempt(moduleId, { signal: options?.signal });
    applyAttemptResponse(response, { notice: options?.notice });
  }, [applyAttemptResponse, hasValidModuleId, moduleId]);

  const loadPageState = useCallback(async () => {
    requestControllerRef.current?.abort();
    const controller = new AbortController();
    requestControllerRef.current = controller;

    setLoading(true);
    setLoadError(null);
    setActionError(null);
    setResumeNotice(null);

    try {
      if (!hasValidModuleId) {
        setQuizSummary(null);
        resetAttemptState();
        setResult(null);
        setLoadError('Invalid module id.');
        return;
      }

      const summaryResponse = await getModuleQuizSummary(moduleId, { signal: controller.signal });
      if (controller.signal.aborted) return;

      setQuizSummary(summaryResponse.quiz);
      resetAttemptState();
      setResult(null);

      if (!summaryResponse.quiz) {
        return;
      }

      if (summaryResponse.quiz.current_attempt) {
        await loadAttempt({
          signal: controller.signal,
          notice: 'Resumed your in-progress quiz attempt.',
        });
        return;
      }

      if (summaryResponse.quiz.latest_result) {
        try {
          await loadResult({ signal: controller.signal });
        } catch {
          if (controller.signal.aborted) return;
          setResult(summaryResponse.quiz.latest_result);
        }
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      setQuizSummary(null);
      resetAttemptState();
      setResult(null);
      setLoadError(getErrorMessage(error, 'Failed to load module quiz.'));
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [hasValidModuleId, loadAttempt, loadResult, moduleId, resetAttemptState]);

  useEffect(() => {
    void loadPageState();
    return () => {
      requestControllerRef.current?.abort();
    };
  }, [loadPageState]);

  const handleStartOrResume = useCallback(async () => {
    if (!hasValidModuleId || startBusy) return;

    setStartBusy(true);
    setActionError(null);

    try {
      const response = await startOrResumeModuleQuiz(moduleId);
      applyAttemptResponse(response, {
        notice: response.created ? null : 'Resumed your in-progress quiz attempt.',
      });
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to start quiz attempt.');
      setActionError(message);
      toast.error(message);
      void loadPageState();
    } finally {
      setStartBusy(false);
    }
  }, [applyAttemptResponse, hasValidModuleId, loadPageState, moduleId, startBusy, toast]);

  const handleSubmit = useCallback(async (source: 'manual' | 'timeout' = 'manual') => {
    if (!hasValidModuleId || submitBusy || !activeAttempt) return;

    setSubmitBusy(true);
    setActionError(null);

    try {
      const response = await submitModuleQuiz(moduleId);
      setQuizSummary(response.quiz);
      resetAttemptState();
      setResult(response.result);
      setResumeNotice(
        response.expired || source === 'timeout'
          ? 'Time expired. Your saved answers were submitted automatically.'
          : null,
      );
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to submit quiz attempt.');
      setActionError(message);
      toast.error(message);
    } finally {
      setSubmitBusy(false);
    }
  }, [activeAttempt, hasValidModuleId, moduleId, resetAttemptState, submitBusy, toast]);

  const handleChoiceSelect = useCallback(async (questionId: number, choiceId: number) => {
    if (!activeAttempt) return;

    setActionError(null);
    setSelectedAnswers((previous) => ({
      ...previous,
      [questionId]: choiceId,
    }));
    setPendingQuestionIds((previous) => ({
      ...previous,
      [questionId]: true,
    }));

    try {
      const response = await saveModuleQuizAnswer(moduleId, questionId, choiceId);
      setQuizSummary(response.quiz);

      if (response.expired && response.result) {
        resetAttemptState();
        setResult(response.result);
        setResumeNotice('Time expired. Your saved answers were submitted automatically.');
        return;
      }

      if (response.attempt) {
        setActiveAttempt(response.attempt);
        setCountdownSeconds(response.attempt.remaining_seconds);
      }
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to save selected answer.');
      setActionError(message);
      toast.error(message);
    } finally {
      setPendingQuestionIds((previous) => {
        const nextState = { ...previous };
        delete nextState[questionId];
        return nextState;
      });
    }
  }, [activeAttempt, moduleId, resetAttemptState, toast]);

  const handleRefreshResult = useCallback(async () => {
    if (!hasValidModuleId) return;

    setRefreshingResult(true);
    setActionError(null);

    try {
      await loadResult();
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to refresh quiz result.');
      setActionError(message);
      toast.error(message);
    } finally {
      setRefreshingResult(false);
    }
  }, [hasValidModuleId, loadResult, toast]);

  useEffect(() => {
    autoSubmitTriggeredRef.current = false;
  }, [activeAttemptId]);

  useEffect(() => {
    if (!activeAttempt?.expires_at) {
      setCountdownSeconds(0);
      return;
    }

    const updateCountdown = () => {
      const expiresAtMs = Date.parse(activeAttempt.expires_at || '');
      const nextSeconds = Number.isFinite(expiresAtMs)
        ? Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1000))
        : activeAttempt.remaining_seconds;

      setCountdownSeconds(nextSeconds);

      if (nextSeconds === 0 && !autoSubmitTriggeredRef.current) {
        autoSubmitTriggeredRef.current = true;
        void handleSubmit('timeout');
      }
    };

    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(intervalId);
  }, [activeAttempt, handleSubmit]);

  const questionProgressLabel = useMemo(() => {
    if (questions.length === 0) return '0 / 0 answered';
    const answeredCount = questions.filter((question) => selectedAnswers[question.question_id]).length;
    return `${answeredCount} / ${questions.length} answered`;
  }, [questions, selectedAnswers]);

  const startButtonLabel = quizSummary?.current_attempt ? 'Resume Quiz' : 'Start Quiz';
  const canRetry = Boolean(quizSummary && quizSummary.attempts_remaining > 0 && !quizSummary.current_attempt);

  return (
    <CyberTransition>
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#050810] dark:text-slate-100">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#cbd5e140_1px,transparent_1px),linear-gradient(to_bottom,#cbd5e140_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-[#0A0E17]/95 sm:px-6">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => navigate(`/module/${moduleId}`)}
                className="mb-2 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-600 transition-colors hover:text-cyan-500 dark:text-cyan-400"
              >
                <ArrowLeft size={14} /> Return To Module
              </button>
              <h1 className="truncate text-xl font-black uppercase tracking-widest sm:text-2xl">
                {quizSummary?.title ?? 'Module Quiz'}
              </h1>
              <p className="mt-1 text-[11px] font-mono uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                {quizSummary ? `${quizSummary.module_code} :: ${quizSummary.module_title}` : 'Quiz workspace'}
              </p>
            </div>

            <div className="hidden rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-right dark:border-slate-700 dark:bg-slate-900 sm:block">
              <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Attempts Left</p>
              <p className="text-lg font-black">{quizSummary?.attempts_remaining ?? 0}</p>
            </div>
          </div>
        </header>

        <ReactAntiCapture
          className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8"
          title="Quiz capture blocked"
          message="Screenshots and print-screen attempts are blocked while this quiz is open."
        >
          {loading ? (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 rounded-3xl border border-slate-200 bg-white/80 text-slate-600 shadow-sm dark:border-slate-800 dark:bg-[#111622]/80 dark:text-slate-300">
              <Loader2 size={34} className="animate-spin text-cyan-500" />
              <p className="text-xs font-mono uppercase tracking-[0.3em]">Loading quiz link...</p>
            </div>
          ) : loadError ? (
            <div className="rounded-3xl border border-red-200 bg-white p-8 shadow-sm dark:border-red-500/30 dark:bg-[#111622]">
              <div className="flex items-start gap-4">
                <AlertTriangle className="mt-1 shrink-0 text-red-500" size={24} />
                <div>
                  <h2 className="text-lg font-black uppercase tracking-wider text-red-600 dark:text-red-300">Quiz Unavailable</h2>
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{loadError}</p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => void loadPageState()}
                      className="rounded-xl border border-slate-200 bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-white transition-colors hover:bg-slate-800 dark:border-slate-700 dark:bg-cyan-500 dark:text-slate-900 dark:hover:bg-cyan-400"
                    >
                      Retry
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(`/module/${moduleId}`)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      Back To Module
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : !quizSummary ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-[#111622]">
              <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
                <FileQuestion size={34} className="text-slate-400 dark:text-slate-500" />
                <h2 className="mt-5 text-xl font-black uppercase tracking-widest">No Active Quiz</h2>
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  This module does not have a published quiz available yet.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {resumeNotice ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                  {resumeNotice}
                </div>
              ) : null}
              {actionError ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  {actionError}
                </div>
              ) : null}

              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
                <section className="space-y-6">
                  {activeAttempt ? (
                    <>
                      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111622] sm:p-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-[11px] font-mono uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
                              Attempt {activeAttempt.attempt_no} in progress
                            </p>
                            <h2 className="mt-2 text-lg font-black uppercase tracking-widest">Answer All Questions In Order</h2>
                          </div>
                          <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 dark:border-cyan-500/30 dark:bg-cyan-500/10">
                            <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-300">
                              <Clock3 size={18} />
                              <span className="text-[11px] font-mono uppercase tracking-[0.25em]">Time Remaining</span>
                            </div>
                            <p className="mt-2 text-2xl font-black tabular-nums">{formatDuration(countdownSeconds)}</p>
                          </div>
                        </div>
                      </div>

                      {questions.map((question) => (
                        <article
                          key={question.question_id}
                          className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111622] sm:p-6"
                        >
                          <div className="mb-5 flex items-center justify-between gap-4">
                            <div>
                              <p className="text-[11px] font-mono uppercase tracking-[0.25em] text-cyan-600 dark:text-cyan-400">
                                Question {question.order_no}
                              </p>
                              <h3 className="mt-2 text-lg font-bold leading-relaxed text-slate-900 dark:text-slate-100">
                                {question.question_text}
                              </h3>
                            </div>
                            {pendingQuestionIds[question.question_id] ? (
                              <Loader2 size={18} className="shrink-0 animate-spin text-cyan-500" />
                            ) : null}
                          </div>

                          <div className="grid gap-3">
                            {question.choices.map((choice) => {
                              const isSelected = selectedAnswers[question.question_id] === choice.choice_id;

                              return (
                                <button
                                  key={choice.choice_id}
                                  type="button"
                                  onClick={() => void handleChoiceSelect(question.question_id, choice.choice_id)}
                                  disabled={Boolean(pendingQuestionIds[question.question_id]) || submitBusy}
                                  className={`flex items-start gap-4 rounded-2xl border px-4 py-4 text-left transition-all ${
                                    isSelected
                                      ? 'border-cyan-300 bg-cyan-50 text-slate-900 shadow-[0_8px_24px_-16px_rgba(8,145,178,0.65)] dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-slate-100'
                                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-slate-700 dark:hover:bg-slate-900'
                                  } disabled:cursor-not-allowed disabled:opacity-70`}
                                >
                                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-black ${
                                    isSelected
                                      ? 'border-cyan-500 bg-cyan-500 text-white dark:text-slate-900'
                                      : 'border-slate-300 text-slate-500 dark:border-slate-700 dark:text-slate-400'
                                  }`}>
                                    {choice.label}
                                  </span>
                                  <span className="text-sm font-semibold leading-relaxed">{choice.choice_text}</span>
                                </button>
                              );
                            })}
                          </div>
                        </article>
                      ))}
                    </>
                  ) : result ? (
                    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-[#111622]">
                      <div className="mx-auto max-w-2xl text-center">
                        {result.passed ? (
                          <CheckCircle2 size={44} className="mx-auto text-emerald-500" />
                        ) : (
                          <XCircle size={44} className="mx-auto text-red-500" />
                        )}
                        <p className="mt-5 text-[11px] font-mono uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                          Attempt {result.attempt_no} {result.status === 'expired' ? 'expired' : 'submitted'}
                        </p>
                        <h2 className={`mt-3 text-3xl font-black uppercase tracking-widest ${
                          result.passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                        }`}>
                          {result.passed ? 'Passed' : 'Not Passed'}
                        </h2>
                        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                          {result.status === 'expired'
                            ? 'Time expired, so your saved answers were submitted automatically.'
                            : 'Your quiz was submitted successfully.'}
                        </p>
                        <p className="mt-2 text-xs font-mono uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                          Submitted {formatSubmittedAt(result.submitted_at)}
                        </p>

                        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                          {canRetry ? (
                            <button
                              type="button"
                              onClick={() => void handleStartOrResume()}
                              disabled={startBusy}
                              className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-500 px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70 dark:border-cyan-500/30"
                            >
                              {startBusy ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                              Retry Quiz
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => void handleRefreshResult()}
                            disabled={refreshingResult}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            {refreshingResult ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                            Refresh Result
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-[#111622]">
                      <div className="mx-auto max-w-2xl text-center">
                        <FileQuestion size={42} className="mx-auto text-cyan-500" />
                        <p className="mt-5 text-[11px] font-mono uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                          Timed module assessment
                        </p>
                        <h2 className="mt-3 text-3xl font-black uppercase tracking-widest">{quizSummary.title}</h2>
                        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
                          Starting the quiz creates an attempt immediately. If you disconnect or reload, the server will keep your in-progress attempt and timer running.
                        </p>

                        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                          <button
                            type="button"
                            onClick={() => void handleStartOrResume()}
                            disabled={startBusy || !quizSummary.can_start}
                            className="inline-flex items-center gap-2 rounded-xl border border-cyan-200 bg-cyan-500 px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70 dark:border-cyan-500/30"
                          >
                            {startBusy ? <Loader2 size={16} className="animate-spin" /> : <Clock3 size={16} />}
                            {startButtonLabel}
                          </button>
                          <button
                            type="button"
                            onClick={() => navigate(`/module/${moduleId}`)}
                            className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            Back To Module
                          </button>
                        </div>

                        {!quizSummary.can_start ? (
                          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.15em] text-amber-600 dark:text-amber-300">
                            Maximum attempts reached for this quiz.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  )}
                </section>

                <aside className="space-y-4">
                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111622]">
                    <p className="text-[11px] font-mono uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">Quiz Intel</p>
                    <dl className="mt-4 space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Questions</dt>
                        <dd className="text-sm font-black">{quizSummary.question_count}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Timer</dt>
                        <dd className="text-sm font-black">{quizSummary.time_limit_minutes} min</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Passing Mark</dt>
                        <dd className="text-sm font-black">{quizSummary.passing_score_percent}%</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Attempts Used</dt>
                        <dd className="text-sm font-black">{quizSummary.attempts_used}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Attempts Left</dt>
                        <dd className="text-sm font-black">{quizSummary.attempts_remaining}</dd>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500 dark:text-slate-400">Progress</dt>
                        <dd className="text-sm font-black">{questionProgressLabel}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-[#111622]">
                    <div className="flex items-start gap-3">
                      <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-500" />
                      <div>
                        <h3 className="text-sm font-black uppercase tracking-[0.18em]">Server Rules</h3>
                        <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                          <li>The timer continues running even if you reload or disconnect.</li>
                          <li>Answers are saved per question as soon as you select a choice.</li>
                          <li>Only pass or fail is shown after submission.</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {activeAttempt ? (
                    <button
                      type="button"
                      onClick={() => void handleSubmit('manual')}
                      disabled={submitBusy}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-900 bg-slate-900 px-4 py-4 text-xs font-black uppercase tracking-[0.2em] text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70 dark:border-cyan-500 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
                    >
                      {submitBusy ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                      Submit Quiz
                    </button>
                  ) : null}
                </aside>
              </div>
            </div>
          )}
        </ReactAntiCapture>
      </div>
    </CyberTransition>
  );
};

export default ModuleQuizPage;
