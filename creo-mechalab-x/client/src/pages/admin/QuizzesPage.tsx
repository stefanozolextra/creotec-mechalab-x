import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock3,
  Copy,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Target,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AdminModalShell from "../../components/admin/ui/AdminModalShell";
import {
  addAdminQuizChoice,
  addAdminQuizQuestion,
  archiveAdminQuiz,
  cloneAdminQuizToDraft,
  createAdminQuizDraft,
  deleteAdminQuiz,
  deleteAdminQuizChoice,
  deleteAdminQuizQuestion,
  getAdminQuizDetail,
  listAdminQuizzes,
  publishAdminQuiz,
  updateAdminQuizChoice,
  updateAdminQuizDraft,
  updateAdminQuizQuestion,
} from "../../api/adminQuizzes";
import { ApiError } from "../../api/http";
import { useToast } from "../../contexts/ToastContext";
import type {
  AdminQuizChoice,
  AdminQuizDetail,
  AdminQuizListItem,
  AdminQuizModuleOption,
  AdminQuizQuestion,
  AdminQuizStatus,
} from "../../types/adminQuiz";

const QUIZ_PASSING_SCORE = 75;

const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};

const getApiErrorDetails = (error: unknown): string[] => {
  if (!(error instanceof ApiError)) return [];
  const details = (error.data as { details?: unknown } | null)?.details;
  return Array.isArray(details) ? details.filter((value): value is string => typeof value === "string") : [];
};

const formatStatusLabel = (status: AdminQuizStatus): string => {
  if (status === "published") return "Published";
  if (status === "archived") return "Archived";
  return "Draft";
};

const formatTimestamp = (value: string | null): string => {
  if (!value) return "n/a";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "n/a";
  return date.toLocaleString();
};

const getStatusClasses = (status: AdminQuizStatus): string => {
  if (status === "published") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300";
  }
  if (status === "archived") {
    return "bg-slate-200 text-slate-700 dark:bg-slate-700/80 dark:text-slate-200";
  }
  return "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300";
};

type CreateDraftFormState = {
  module_id: string;
  title: string;
  max_attempts: string;
  time_limit_minutes: string;
};

const defaultCreateDraftForm = (modules: AdminQuizModuleOption[]): CreateDraftFormState => ({
  module_id: modules[0] ? String(modules[0].module_id) : "",
  title: "",
  max_attempts: "1",
  time_limit_minutes: "15",
});

const sortQuestions = (questions: AdminQuizQuestion[]): AdminQuizQuestion[] => {
  return [...questions].sort((a, b) => a.order_no - b.order_no || a.question_id - b.question_id);
};

const sortChoices = (choices: AdminQuizChoice[]): AdminQuizChoice[] => {
  return [...choices].sort((a, b) => a.choice_no - b.choice_no || a.choice_id - b.choice_id);
};

const buildLocalPublishChecks = (
  quiz: AdminQuizDetail | null,
): { ready: boolean; errors: string[] } => {
  if (!quiz) return { ready: false, errors: [] };

  const errors: string[] = [];
  if (!quiz.title.trim()) {
    errors.push("Quiz title is required.");
  }
  if (!Number.isInteger(quiz.module_id) || quiz.module_id < 1) {
    errors.push("Quiz must be linked to a valid module.");
  }
  if (!Number.isInteger(quiz.time_limit_minutes) || quiz.time_limit_minutes < 1) {
    errors.push("Timer is required and must be a positive number of minutes.");
  }
  if (!Number.isInteger(quiz.max_attempts) || quiz.max_attempts < 1) {
    errors.push("Max attempts must be a positive integer.");
  }
  if (quiz.questions.length === 0) {
    errors.push("Quiz must contain at least 1 question before publishing.");
  }

  quiz.questions.forEach((question, questionIndex) => {
    const displayNumber = questionIndex + 1;
    if (!question.question_text.trim()) {
      errors.push(`Question ${displayNumber} must have text.`);
    }
    if (question.order_no !== displayNumber) {
      errors.push("Questions must use a continuous order starting at 1.");
    }
    if (question.choices.length !== 4) {
      errors.push(`Question ${displayNumber} must have exactly 4 choices.`);
    }

    let correctCount = 0;
    question.choices.forEach((choice, choiceIndex) => {
      if (!choice.choice_text.trim()) {
        errors.push(`Question ${displayNumber}, choice ${choiceIndex + 1} must have text.`);
      }
      if (choice.choice_no !== choiceIndex + 1) {
        errors.push(`Question ${displayNumber} choices must stay in order.`);
      }
      if (choice.is_correct) {
        correctCount += 1;
      }
    });

    if (correctCount !== 1) {
      errors.push(`Question ${displayNumber} must have exactly 1 correct choice.`);
    }
  });

  return {
    ready: errors.length === 0,
    errors: [...new Set(errors)],
  };
};

export default function QuizzesPage() {
  const toast = useToast();
  const [items, setItems] = useState<AdminQuizListItem[]>([]);
  const [modules, setModules] = useState<AdminQuizModuleOption[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<number | null>(null);
  const [draftQuiz, setDraftQuiz] = useState<AdminQuizDetail | null>(null);
  const [query, setQuery] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [refreshSeq, setRefreshSeq] = useState(0);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createDraftForm, setCreateDraftForm] = useState<CreateDraftFormState>(() => defaultCreateDraftForm([]));
  const [newQuestionText, setNewQuestionText] = useState("");
  const [newChoiceDrafts, setNewChoiceDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    let active = true;

    const loadList = async () => {
      setLoadingList(true);
      setListError(null);

      try {
        const response = await listAdminQuizzes();
        if (!active) return;

        setItems(response.items ?? []);
        setModules(response.modules ?? []);
        setCreateDraftForm((current) => {
          const hasSelectedModule = response.modules.some(
            (module) => String(module.module_id) === current.module_id,
          );
          return hasSelectedModule ? current : defaultCreateDraftForm(response.modules ?? []);
        });
        setSelectedQuizId((current) => {
          if (current && response.items.some((item) => item.quiz_id === current)) {
            return current;
          }
          return response.items[0]?.quiz_id ?? null;
        });
      } catch (error) {
        if (!active) return;
        setItems([]);
        setModules([]);
        setSelectedQuizId(null);
        setDraftQuiz(null);
        setListError(toErrorMessage(error, "Failed to load quizzes."));
      } finally {
        if (active) setLoadingList(false);
      }
    };

    void loadList();
    return () => {
      active = false;
    };
  }, [refreshSeq]);

  useEffect(() => {
    if (!selectedQuizId) {
      setDraftQuiz(null);
      setDetailError(null);
      return;
    }

    let active = true;
    const loadDetail = async () => {
      setLoadingDetail(true);
      setDetailError(null);

      try {
        const response = await getAdminQuizDetail(selectedQuizId);
        if (!active) return;
        const quiz = response.quiz ? {
          ...response.quiz,
          questions: sortQuestions(
            response.quiz.questions.map((question) => ({
              ...question,
              choices: sortChoices(question.choices),
            })),
          ),
        } : null;
        setDraftQuiz(quiz);
      } catch (error) {
        if (!active) return;
        setDraftQuiz(null);
        setDetailError(toErrorMessage(error, "Failed to load quiz detail."));
      } finally {
        if (active) setLoadingDetail(false);
      }
    };

    void loadDetail();
    return () => {
      active = false;
    };
  }, [selectedQuizId, refreshSeq]);

  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;

    return items.filter((item) => {
      return (
        item.title.toLowerCase().includes(needle) ||
        item.module_code.toLowerCase().includes(needle) ||
        item.module_title.toLowerCase().includes(needle) ||
        formatStatusLabel(item.status).toLowerCase().includes(needle)
      );
    });
  }, [items, query]);

  const isDraft = draftQuiz?.status === "draft";
  const publishChecks = useMemo(() => buildLocalPublishChecks(draftQuiz), [draftQuiz]);

  const refreshData = () => setRefreshSeq((current) => current + 1);

  const updateQuestionDraftText = (questionId: number, questionText: string) => {
    setDraftQuiz((current) => {
      if (!current) return current;
      return {
        ...current,
        questions: current.questions.map((question) => (
          question.question_id === questionId
            ? { ...question, question_text: questionText }
            : question
        )),
      };
    });
  };


  const setChoiceTextDraft = (questionId: number, choiceId: number, choiceText: string) => {
    setDraftQuiz((current) => {
      if (!current) return current;
      return {
        ...current,
        questions: current.questions.map((question) => {
          if (question.question_id !== questionId) return question;
          return {
            ...question,
            choices: question.choices.map((choice) => (
              choice.choice_id === choiceId ? { ...choice, choice_text: choiceText } : choice
            )),
          };
        }),
      };
    });
  };

  const setCorrectChoiceDraft = (questionId: number, choiceId: number) => {
    setDraftQuiz((current) => {
      if (!current) return current;
      return {
        ...current,
        questions: current.questions.map((question) => {
          if (question.question_id !== questionId) return question;
          const nextChoices = question.choices.map((choice) => ({
            ...choice,
            is_correct: choice.choice_id === choiceId,
          }));
          return {
            ...question,
            choices: nextChoices,
            correct_choice_count: 1,
          };
        }),
      };
    });
  };

  const runBusyAction = async (key: string, task: () => Promise<void>) => {
    setBusyKey(key);
    try {
      await task();
    } finally {
      setBusyKey(null);
    }
  };

  const handleCreateDraft = async () => {
    await runBusyAction("create-quiz", async () => {
      try {
        const response = await createAdminQuizDraft({
          module_id: Number(createDraftForm.module_id),
          title: createDraftForm.title,
          max_attempts: Number(createDraftForm.max_attempts),
          time_limit_minutes: Number(createDraftForm.time_limit_minutes),
        });
        const nextQuizId = response.quiz?.quiz_id ?? null;
        setShowCreateModal(false);
        setCreateDraftForm(defaultCreateDraftForm(modules));
        if (nextQuizId) {
          setSelectedQuizId(nextQuizId);
        }
        toast.success("Draft quiz created.");
        refreshData();
      } catch (error) {
        toast.error(toErrorMessage(error, "Failed to create draft quiz."));
      }
    });
  };

  const handleSaveQuizSettings = async () => {
    if (!draftQuiz) return;

    await runBusyAction("save-quiz", async () => {
      try {
        await updateAdminQuizDraft(draftQuiz.quiz_id, {
          title: draftQuiz.title,
          module_id: draftQuiz.module_id,
          max_attempts: draftQuiz.max_attempts,
          time_limit_minutes: draftQuiz.time_limit_minutes,
        });
        toast.success("Draft quiz updated.");
        refreshData();
      } catch (error) {
        toast.error(toErrorMessage(error, "Failed to update draft quiz."));
      }
    });
  };

  const handleAddQuestion = async () => {
    if (!draftQuiz) return;

    await runBusyAction("add-question", async () => {
      try {
        await addAdminQuizQuestion(draftQuiz.quiz_id, newQuestionText);
        setNewQuestionText("");
        toast.success("Question added.");
        refreshData();
      } catch (error) {
        toast.error(toErrorMessage(error, "Failed to add question."));
      }
    });
  };

  const handleSaveQuestion = async (question: AdminQuizQuestion) => {
    if (!draftQuiz) return;

    await runBusyAction(`save-question-${question.question_id}`, async () => {
      try {
        await updateAdminQuizQuestion(draftQuiz.quiz_id, question.question_id, {
          question_text: question.question_text,
        });
        toast.success("Question updated.");
        refreshData();
      } catch (error) {
        toast.error(toErrorMessage(error, "Failed to update question."));
      }
    });
  };

  const handleMoveQuestion = async (question: AdminQuizQuestion, nextOrderNo: number) => {
    if (!draftQuiz) return;

    await runBusyAction(`move-question-${question.question_id}`, async () => {
      try {
        await updateAdminQuizQuestion(draftQuiz.quiz_id, question.question_id, {
          order_no: nextOrderNo,
        });
        refreshData();
      } catch (error) {
        toast.error(toErrorMessage(error, "Failed to reorder question."));
      }
    });
  };

  const handleDeleteQuestion = async (question: AdminQuizQuestion) => {
    if (!draftQuiz) return;
    if (!window.confirm(`Delete Question ${question.order_no}?`)) return;

    await runBusyAction(`delete-question-${question.question_id}`, async () => {
      try {
        await deleteAdminQuizQuestion(draftQuiz.quiz_id, question.question_id);
        toast.success("Question deleted.");
        refreshData();
      } catch (error) {
        toast.error(toErrorMessage(error, "Failed to delete question."));
      }
    });
  };

  const handleAddChoice = async (questionId: number) => {
    if (!draftQuiz) return;

    await runBusyAction(`add-choice-${questionId}`, async () => {
      try {
        await addAdminQuizChoice(draftQuiz.quiz_id, questionId, {
          choice_text: newChoiceDrafts[questionId] || "",
        });
        setNewChoiceDrafts((current) => ({ ...current, [questionId]: "" }));
        toast.success("Choice added.");
        refreshData();
      } catch (error) {
        toast.error(toErrorMessage(error, "Failed to add choice."));
      }
    });
  };

  const handleSaveChoice = async (questionId: number, choice: AdminQuizChoice) => {
    if (!draftQuiz) return;

    await runBusyAction(`save-choice-${choice.choice_id}`, async () => {
      try {
        await updateAdminQuizChoice(draftQuiz.quiz_id, questionId, choice.choice_id, {
          choice_text: choice.choice_text,
          is_correct: choice.is_correct,
        });
        toast.success(`Choice ${choice.label} updated.`);
        refreshData();
      } catch (error) {
        toast.error(toErrorMessage(error, "Failed to update choice."));
      }
    });
  };

  const handleDeleteChoice = async (questionId: number, choice: AdminQuizChoice) => {
    if (!draftQuiz) return;
    if (!window.confirm(`Delete choice ${choice.label}?`)) return;

    await runBusyAction(`delete-choice-${choice.choice_id}`, async () => {
      try {
        await deleteAdminQuizChoice(draftQuiz.quiz_id, questionId, choice.choice_id);
        toast.success(`Choice ${choice.label} deleted.`);
        refreshData();
      } catch (error) {
        toast.error(toErrorMessage(error, "Failed to delete choice."));
      }
    });
  };

  const handlePublishQuiz = async () => {
    if (!draftQuiz) return;

    await runBusyAction("publish-quiz", async () => {
      try {
        await publishAdminQuiz(draftQuiz.quiz_id);
        toast.success("Quiz published.");
        refreshData();
      } catch (error) {
        const details = getApiErrorDetails(error);
        if (details.length > 0) {
          setDetailError(details.join(" "));
        }
        toast.error(toErrorMessage(error, "Failed to publish quiz."));
      }
    });
  };

  const handleArchiveQuiz = async () => {
    if (!draftQuiz) return;
    if (!window.confirm("Archive this published quiz?")) return;

    await runBusyAction("archive-quiz", async () => {
      try {
        await archiveAdminQuiz(draftQuiz.quiz_id);
        toast.success("Quiz archived.");
        refreshData();
      } catch (error) {
        toast.error(toErrorMessage(error, "Failed to archive quiz."));
      }
    });
  };

  const handleCloneQuiz = async () => {
    if (!draftQuiz) return;

    await runBusyAction("clone-quiz", async () => {
      try {
        const response = await cloneAdminQuizToDraft(draftQuiz.quiz_id);
        const nextQuizId = response.quiz?.quiz_id ?? null;
        if (nextQuizId) {
          setSelectedQuizId(nextQuizId);
        }
        toast.success("Draft clone created.");
        refreshData();
      } catch (error) {
        toast.error(toErrorMessage(error, "Failed to clone quiz."));
      }
    });
  };

  const handleDeleteQuiz = async () => {
    if (!draftQuiz) return;
    if (!window.confirm("Delete this draft quiz? This cannot be undone.")) return;

    await runBusyAction("delete-quiz", async () => {
      try {
        await deleteAdminQuiz(draftQuiz.quiz_id);
        toast.success("Draft quiz deleted.");
        setSelectedQuizId(null);
        refreshData();
      } catch (error) {
        toast.error(toErrorMessage(error, "Failed to delete draft quiz."));
      }
    });
  };

  return (
    <div className="space-y-6 pb-6">
      <section className="rounded-[28px] border border-slate-200/80 dark:border-slate-700/70 bg-white/95 dark:bg-[#111827] shadow-[0_18px_50px_-28px_rgba(15,23,42,0.45)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between px-5 sm:px-6 py-5 border-b border-slate-100 dark:border-slate-700/50">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-600 dark:text-cyan-400">
              Quiz Management
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-[#0B1B3D] dark:text-slate-100">
              Module quizzes stay server-controlled
            </h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
              Draft, publish, archive, and clone module-linked quizzes without changing trainee quiz-taking yet.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <label className="relative flex-1 min-w-[240px]">
              <span className="sr-only">Search quizzes</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by quiz or module"
                className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0F172A] px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-100 outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 dark:focus:ring-cyan-500/20"
              />
            </label>
            <button
              type="button"
              onClick={refreshData}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-100 hover:border-cyan-300 dark:hover:border-cyan-500 transition-colors"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              disabled={modules.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0B1B3D] px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#102754] disabled:opacity-60"
            >
              <Plus size={16} />
              New Draft Quiz
            </button>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)] p-5 sm:p-6">
          <aside className="rounded-[24px] border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-[#0F172A] min-h-[420px]">
            <div className="px-4 py-4 border-b border-slate-200/80 dark:border-slate-700/70 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  Quizzes
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {loadingList ? "Loading..." : `${filteredItems.length} item${filteredItems.length === 1 ? "" : "s"}`}
                </p>
              </div>
              {loadingList ? <Loader2 size={16} className="animate-spin text-cyan-500" /> : null}
            </div>

            {listError ? (
              <div className="m-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                {listError}
              </div>
            ) : null}

            <div className="max-h-[calc(100dvh-320px)] overflow-y-auto p-3 space-y-3">
              {!loadingList && filteredItems.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                  No quizzes found.
                </div>
              ) : null}

              {filteredItems.map((item) => {
                const isSelected = item.quiz_id === selectedQuizId;
                return (
                  <button
                    key={item.quiz_id}
                    type="button"
                    onClick={() => setSelectedQuizId(item.quiz_id)}
                    className={`w-full rounded-[22px] border px-4 py-4 text-left transition-all ${
                      isSelected
                        ? "border-cyan-300 bg-white shadow-sm dark:border-cyan-500/40 dark:bg-slate-900"
                        : "border-slate-200 bg-white/90 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/60 dark:hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-[#0B1B3D] dark:text-slate-100 truncate">
                          {item.title}
                        </p>
                        <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                          {item.module_code} • {item.module_title}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${getStatusClasses(item.status)}`}>
                        {formatStatusLabel(item.status)}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <div className="rounded-xl bg-slate-100/80 dark:bg-slate-800 px-2 py-2">
                        <div className="uppercase tracking-[0.15em]">Questions</div>
                        <div className="mt-1 text-sm font-black text-slate-700 dark:text-slate-100">{item.question_count}</div>
                      </div>
                      <div className="rounded-xl bg-slate-100/80 dark:bg-slate-800 px-2 py-2">
                        <div className="uppercase tracking-[0.15em]">Attempts</div>
                        <div className="mt-1 text-sm font-black text-slate-700 dark:text-slate-100">{item.attempt_count}</div>
                      </div>
                      <div className="rounded-xl bg-slate-100/80 dark:bg-slate-800 px-2 py-2">
                        <div className="uppercase tracking-[0.15em]">Timer</div>
                        <div className="mt-1 text-sm font-black text-slate-700 dark:text-slate-100">{item.time_limit_minutes}m</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="rounded-[24px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111827] min-h-[420px]">
            {loadingDetail ? (
              <div className="h-full min-h-[420px] flex items-center justify-center text-slate-500 dark:text-slate-400">
                <div className="inline-flex items-center gap-3 text-sm font-semibold">
                  <Loader2 size={18} className="animate-spin text-cyan-500" />
                  Loading quiz detail...
                </div>
              </div>
            ) : !draftQuiz ? (
              <div className="h-full min-h-[420px] flex items-center justify-center px-6 text-center text-slate-500 dark:text-slate-400">
                <div>
                  <p className="text-lg font-black text-slate-700 dark:text-slate-200">Select a quiz</p>
                  <p className="mt-2 text-sm max-w-md">
                    Choose a quiz from the list or create a new draft to start building questions and answer choices.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="px-5 sm:px-6 py-5 border-b border-slate-100 dark:border-slate-700/50 space-y-4">
                  <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] ${getStatusClasses(draftQuiz.status)}`}>
                          {formatStatusLabel(draftQuiz.status)}
                        </span>
                        <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-600 dark:text-slate-300">
                          {draftQuiz.module_code}
                        </span>
                        <span className="rounded-full bg-blue-50 dark:bg-blue-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">
                          Pass {QUIZ_PASSING_SCORE}%
                        </span>
                      </div>
                      <h3 className="mt-3 text-2xl font-black tracking-tight text-[#0B1B3D] dark:text-slate-100">
                        {draftQuiz.title}
                      </h3>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        {draftQuiz.module_title}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {draftQuiz.can_publish ? (
                        <button
                          type="button"
                          onClick={handlePublishQuiz}
                          disabled={busyKey === "publish-quiz"}
                          className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {busyKey === "publish-quiz" ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                          Publish
                        </button>
                      ) : null}
                      {draftQuiz.can_archive ? (
                        <button
                          type="button"
                          onClick={handleArchiveQuiz}
                          disabled={busyKey === "archive-quiz"}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-600 disabled:opacity-60"
                        >
                          {busyKey === "archive-quiz" ? <Loader2 size={16} className="animate-spin" /> : <Archive size={16} />}
                          Archive
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={handleCloneQuiz}
                        disabled={busyKey === "clone-quiz"}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-600 disabled:opacity-60"
                      >
                        {busyKey === "clone-quiz" ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
                        Clone to Draft
                      </button>
                      {draftQuiz.can_delete ? (
                        <button
                          type="button"
                          onClick={handleDeleteQuiz}
                          disabled={busyKey === "delete-quiz"}
                          className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-4 py-2.5 text-sm font-bold text-rose-700 dark:text-rose-200 hover:border-rose-300 disabled:opacity-60"
                        >
                          {busyKey === "delete-quiz" ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {detailError ? (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                      {detailError}
                    </div>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="rounded-[20px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0F172A] px-4 py-4">
                      <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        <Clock3 size={14} />
                        Timer
                      </div>
                      <div className="mt-2 text-2xl font-black text-slate-800 dark:text-slate-100">
                        {draftQuiz.time_limit_minutes}m
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0F172A] px-4 py-4">
                      <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        <Target size={14} />
                        Attempts
                      </div>
                      <div className="mt-2 text-2xl font-black text-slate-800 dark:text-slate-100">
                        {draftQuiz.max_attempts}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0F172A] px-4 py-4">
                      <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        <CheckCircle2 size={14} />
                        Questions
                      </div>
                      <div className="mt-2 text-2xl font-black text-slate-800 dark:text-slate-100">
                        {draftQuiz.stats.question_count}
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0F172A] px-4 py-4">
                      <div className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                        <Settings2 size={14} />
                        History
                      </div>
                      <div className="mt-2 text-2xl font-black text-slate-800 dark:text-slate-100">
                        {draftQuiz.stats.attempt_count}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_360px]">
                    <div className="rounded-[22px] border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-[#0F172A] p-4 sm:p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                            Draft Settings
                          </h4>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            Edit metadata only while the quiz is a draft.
                          </p>
                        </div>
                        {isDraft ? (
                          <button
                            type="button"
                            onClick={handleSaveQuizSettings}
                            disabled={busyKey === "save-quiz"}
                            className="inline-flex items-center gap-2 rounded-2xl bg-[#0B1B3D] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#102754] disabled:opacity-60"
                          >
                            {busyKey === "save-quiz" ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            Save
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                          Title
                          <input
                            value={draftQuiz.title}
                            onChange={(event) => setDraftQuiz((current) => current ? { ...current, title: event.target.value } : current)}
                            disabled={!isDraft}
                            className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-100 disabled:opacity-70"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                          Module
                          <select
                            value={String(draftQuiz.module_id)}
                            onChange={(event) => setDraftQuiz((current) => current ? { ...current, module_id: Number(event.target.value) } : current)}
                            disabled={!isDraft}
                            className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-100 disabled:opacity-70"
                          >
                            {modules.map((module) => (
                              <option key={module.module_id} value={module.module_id}>
                                {module.module_code} • {module.module_title}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                          Time Limit (minutes)
                          <input
                            type="number"
                            min={1}
                            value={draftQuiz.time_limit_minutes}
                            onChange={(event) => setDraftQuiz((current) => current ? { ...current, time_limit_minutes: Number(event.target.value) } : current)}
                            disabled={!isDraft}
                            className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-100 disabled:opacity-70"
                          />
                        </label>
                        <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
                          Max Attempts
                          <input
                            type="number"
                            min={1}
                            value={draftQuiz.max_attempts}
                            onChange={(event) => setDraftQuiz((current) => current ? { ...current, max_attempts: Number(event.target.value) } : current)}
                            disabled={!isDraft}
                            className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-100 disabled:opacity-70"
                          />
                        </label>
                      </div>
                    </div>

                    <div className={`rounded-[22px] border px-4 py-4 ${
                      publishChecks.ready
                        ? "border-emerald-200 bg-emerald-50/80 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                        : "border-amber-200 bg-amber-50/80 dark:border-amber-500/30 dark:bg-amber-500/10"
                    }`}>
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 ${publishChecks.ready ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"}`}>
                          {publishChecks.ready ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-sm font-black uppercase tracking-[0.22em] text-slate-700 dark:text-slate-100">
                            Publish Checks
                          </h4>
                          {publishChecks.ready ? (
                            <p className="mt-2 text-sm font-semibold text-emerald-700 dark:text-emerald-200">
                              This draft satisfies the current backend publish rules.
                            </p>
                          ) : (
                            <div className="mt-2 space-y-2">
                              {publishChecks.errors.map((errorText) => (
                                <p key={errorText} className="text-sm font-medium text-amber-800 dark:text-amber-100">
                                  {errorText}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <div className="rounded-2xl bg-slate-50 dark:bg-[#0F172A] px-4 py-3 border border-slate-200 dark:border-slate-700">
                      Created: <span className="text-slate-700 dark:text-slate-200">{formatTimestamp(draftQuiz.created_at)}</span>
                    </div>
                    <div className="rounded-2xl bg-slate-50 dark:bg-[#0F172A] px-4 py-3 border border-slate-200 dark:border-slate-700">
                      Published: <span className="text-slate-700 dark:text-slate-200">{formatTimestamp(draftQuiz.published_at)}</span>
                    </div>
                    <div className="rounded-2xl bg-slate-50 dark:bg-[#0F172A] px-4 py-3 border border-slate-200 dark:border-slate-700">
                      Archived: <span className="text-slate-700 dark:text-slate-200">{formatTimestamp(draftQuiz.archived_at)}</span>
                    </div>
                  </div>
                </div>

                <div className="px-5 sm:px-6 py-5 space-y-5">
                  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                        Questions
                      </h4>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        Fixed question order, 4 choices per question, and exactly 1 correct answer.
                      </p>
                    </div>
                    {isDraft ? (
                      <div className="w-full md:max-w-xl flex flex-col sm:flex-row gap-3">
                        <textarea
                          value={newQuestionText}
                          onChange={(event) => setNewQuestionText(event.target.value)}
                          rows={2}
                          placeholder="Add a new question"
                          className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-100"
                        />
                        <button
                          type="button"
                          onClick={handleAddQuestion}
                          disabled={busyKey === "add-question"}
                          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0B1B3D] px-4 py-3 text-sm font-bold text-white hover:bg-[#102754] disabled:opacity-60"
                        >
                          {busyKey === "add-question" ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                          Add Question
                        </button>
                      </div>
                    ) : null}
                  </div>

                  {draftQuiz.questions.length === 0 ? (
                    <div className="rounded-[22px] border border-dashed border-slate-300 dark:border-slate-700 px-5 py-10 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                      No questions yet.
                    </div>
                  ) : null}

                  {draftQuiz.questions.map((question, index) => {
                    const canMoveUp = index > 0;
                    const canMoveDown = index < draftQuiz.questions.length - 1;
                    const addChoiceDraft = newChoiceDrafts[question.question_id] || "";

                    return (
                      <article
                        key={question.question_id}
                        className="rounded-[24px] border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-[#0F172A] p-4 sm:p-5 space-y-4"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                              Question {question.order_no}
                            </p>
                            <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                              {question.choice_count}/4 choices • {question.correct_choice_count} correct
                            </p>
                          </div>
                          {isDraft ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleMoveQuestion(question, question.order_no - 1)}
                                disabled={!canMoveUp || busyKey === `move-question-${question.question_id}`}
                                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-100 disabled:opacity-50"
                              >
                                <ArrowUp size={14} />
                                Up
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveQuestion(question, question.order_no + 1)}
                                disabled={!canMoveDown || busyKey === `move-question-${question.question_id}`}
                                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-100 disabled:opacity-50"
                              >
                                <ArrowDown size={14} />
                                Down
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveQuestion(question)}
                                disabled={busyKey === `save-question-${question.question_id}`}
                                className="inline-flex items-center gap-2 rounded-2xl bg-[#0B1B3D] px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                              >
                                {busyKey === `save-question-${question.question_id}` ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteQuestion(question)}
                                disabled={busyKey === `delete-question-${question.question_id}`}
                                className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-700 dark:text-rose-200 disabled:opacity-60"
                              >
                                {busyKey === `delete-question-${question.question_id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>

                        <textarea
                          value={question.question_text}
                          onChange={(event) => updateQuestionDraftText(question.question_id, event.target.value)}
                          disabled={!isDraft}
                          rows={3}
                          className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-100 disabled:opacity-80"
                        />

                        <div className="space-y-3">
                          {question.choices.map((choice) => (
                            <div
                              key={choice.choice_id}
                              className="rounded-[20px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-4"
                            >
                              <div className="flex flex-col xl:flex-row xl:items-center gap-3">
                                <label className="inline-flex items-center gap-3 text-sm font-black text-slate-700 dark:text-slate-100">
                                  <input
                                    type="radio"
                                    name={`question-${question.question_id}-correct-choice`}
                                    checked={choice.is_correct}
                                    onChange={() => setCorrectChoiceDraft(question.question_id, choice.choice_id)}
                                    disabled={!isDraft}
                                    className="h-4 w-4 accent-emerald-600"
                                  />
                                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-xs">
                                    {choice.label}
                                  </span>
                                </label>
                                <input
                                  value={choice.choice_text}
                                  onChange={(event) => setChoiceTextDraft(question.question_id, choice.choice_id, event.target.value)}
                                  disabled={!isDraft}
                                  className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0F172A] px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-100 disabled:opacity-80"
                                />
                                {isDraft ? (
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleSaveChoice(question.question_id, choice)}
                                      disabled={busyKey === `save-choice-${choice.choice_id}`}
                                      className="inline-flex items-center gap-2 rounded-2xl bg-[#0B1B3D] px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                                    >
                                      {busyKey === `save-choice-${choice.choice_id}` ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteChoice(question.question_id, choice)}
                                      disabled={busyKey === `delete-choice-${choice.choice_id}`}
                                      className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-700 dark:text-rose-200 disabled:opacity-60"
                                    >
                                      {busyKey === `delete-choice-${choice.choice_id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                      Delete
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>

                        {isDraft && question.choices.length < 4 ? (
                          <div className="rounded-[20px] border border-dashed border-slate-300 dark:border-slate-700 px-4 py-4">
                            <div className="flex flex-col sm:flex-row gap-3">
                              <input
                                value={addChoiceDraft}
                                onChange={(event) => setNewChoiceDrafts((current) => ({
                                  ...current,
                                  [question.question_id]: event.target.value,
                                }))}
                                placeholder={`Add choice ${question.choices.length + 1}`}
                                className="flex-1 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-100"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddChoice(question.question_id)}
                                disabled={busyKey === `add-choice-${question.question_id}`}
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0B1B3D] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                              >
                                {busyKey === `add-choice-${question.question_id}` ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                                Add Choice
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        </div>
      </section>

      <AdminModalShell
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Draft Quiz"
        description="Create a new module-linked draft quiz. Passing score is fixed at 75%."
        icon={<Settings2 size={18} />}
        maxWidthClass="max-w-xl"
        footer={(
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0F172A] px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateDraft}
              disabled={busyKey === "create-quiz" || modules.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#0B1B3D] px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {busyKey === "create-quiz" ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Create Draft
            </button>
          </div>
        )}
      >
        <div className="px-5 sm:px-6 py-5 space-y-4">
          <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
            Module
            <select
              value={createDraftForm.module_id}
              onChange={(event) => setCreateDraftForm((current) => ({ ...current, module_id: event.target.value }))}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-100"
            >
              {modules.map((module) => (
                <option key={module.module_id} value={module.module_id}>
                  {module.module_code} • {module.module_title}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
            Quiz Title
            <input
              value={createDraftForm.title}
              onChange={(event) => setCreateDraftForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="Example: Module 1 Assessment"
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-100"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
              Max Attempts
              <input
                type="number"
                min={1}
                value={createDraftForm.max_attempts}
                onChange={(event) => setCreateDraftForm((current) => ({ ...current, max_attempts: event.target.value }))}
                className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-100"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
              Time Limit (minutes)
              <input
                type="number"
                min={1}
                value={createDraftForm.time_limit_minutes}
                onChange={(event) => setCreateDraftForm((current) => ({ ...current, time_limit_minutes: event.target.value }))}
                className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-100"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm font-medium text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
            Passing score is fixed at {QUIZ_PASSING_SCORE}%. Trainee quiz-taking, timer runtime behavior, and result screens are still deferred.
          </div>
        </div>
      </AdminModalShell>
    </div>
  );
}
