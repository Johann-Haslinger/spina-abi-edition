import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../../../db/db';
import type { Asset, Chapter, Requirement } from '../../../../domain/models';
import { useCurriculumStore } from '../../../../stores/curriculumStore';
import { useNotificationsStore } from '../../../../stores/notificationsStore';

const EMPTY_CHAPTERS: Chapter[] = [];
const EMPTY_REQUIREMENTS: Requirement[] = [];

export function TopicCurriculumView(props: {
  subjectId: string;
  topicId: string;
  assets: Asset[];
}) {
  const navigate = useNavigate();
  const pushNotification = useNotificationsStore((state) => state.push);
  const chapters = useCurriculumStore(
    (state) => state.chaptersByTopic[props.topicId] ?? EMPTY_CHAPTERS,
  );
  const requirements = useCurriculumStore(
    (state) => state.requirementsByTopic[props.topicId] ?? EMPTY_REQUIREMENTS,
  );
  const loading = useCurriculumStore((state) => state.loadingByTopic[props.topicId] ?? false);
  const error = useCurriculumStore((state) => state.errorByTopic[props.topicId]);
  const refreshTopicCurriculum = useCurriculumStore((state) => state.refreshTopicCurriculum);
  const generateChapterExplanation = useCurriculumStore(
    (state) => state.generateChapterExplanation,
  );
  const lastTopicIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (lastTopicIdRef.current === props.topicId) return;
    lastTopicIdRef.current = props.topicId;

    const s = useCurriculumStore.getState();
    const alreadyLoaded = (s.chaptersByTopic[props.topicId]?.length ?? 0) > 0;
    const isLoading = s.loadingByTopic[props.topicId] ?? false;
    if (alreadyLoaded || isLoading) return;

    void refreshTopicCurriculum(props.topicId);
  }, [props.topicId]);

  const chapterCards = useChapterCards({
    chapters,
    requirements,
    assets: props.assets,
  });

  if (loading) return <div className="mt-8 text-sm text-slate-400">Kapitel werden geladen…</div>;
  if (error) {
    return (
      <div className="mt-8 rounded-2xl border border-rose-900/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
        {error}
      </div>
    );
  }
  if (!chapterCards.length) {
    return (
      <div className="mt-10 rounded-3xl border border-white/8 bg-white/4 px-5 py-4 text-sm text-white/65">
        Für dieses Thema gibt es noch keine Kapitel und Skills. Importiere zuerst einen Lehrplan auf
        der Fachseite.
      </div>
    );
  }

  return (
    <div className="mt-10 space-y-5">
      {chapterCards.map(({ chapter, mastery, requirements: chapterRequirements }) => (
        <section key={chapter.id} className="rounded-4xl border border-white/8 bg-white/4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xl font-semibold text-white">{chapter.name}</div>
              {chapter.description ? (
                <p className="mt-2 max-w-3xl text-sm text-white/70">{chapter.description}</p>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <MasteryPill value={mastery} />
              <GenerateChapterButton
                chapter={chapter}
                subjectId={props.subjectId}
                topicId={props.topicId}
                onGenerated={(assetId) =>
                  navigate(`/subjects/${props.subjectId}/topics/${props.topicId}/${assetId}`)
                }
                generateChapterExplanation={generateChapterExplanation}
                pushNotification={pushNotification}
              />
            </div>
          </div>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-white"
              style={{ width: `${Math.round(mastery * 100)}%` }}
            />
          </div>

          <div className="mt-5 space-y-3">
            {chapterRequirements.map(({ requirement, linkedTasks }) => (
              <div
                key={requirement.id}
                className="rounded-3xl border border-white/8 bg-slate-950/30 px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{requirement.name}</div>
                    {requirement.description ? (
                      <div className="mt-1 text-sm text-white/65">{requirement.description}</div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-white/75">
                      Schwierigkeit {requirement.difficulty}
                    </span>
                    <MasteryPill value={requirement.mastery} />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {linkedTasks.length ? (
                    linkedTasks.map((task) => (
                      <button
                        key={task.key}
                        type="button"
                        onClick={() =>
                          navigate(
                            `/subjects/${props.subjectId}/topics/${props.topicId}/${task.asset.id}`,
                          )
                        }
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/80 hover:bg-white/10"
                      >
                        {task.asset.title} · {task.label}
                      </button>
                    ))
                  ) : (
                    <span className="text-xs text-white/40">Noch keine referenzierten Übungen</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function GenerateChapterButton(props: {
  chapter: Chapter;
  subjectId: string;
  topicId: string;
  onGenerated: (assetId: string) => void;
  generateChapterExplanation: (input: {
    subjectId: string;
    topicId: string;
    chapterId: string;
  }) => Promise<string>;
  pushNotification: (input: {
    tone?: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message?: string;
  }) => void;
}) {
  const [loading, setLoading] = useState(false);

  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const assetId = await props.generateChapterExplanation({
            subjectId: props.subjectId,
            topicId: props.topicId,
            chapterId: props.chapter.id,
          });
          props.pushNotification({
            tone: 'success',
            title: 'Merkblatt generiert',
            message: `${props.chapter.name} wurde als Cheatsheet gespeichert.`,
          });
          props.onGenerated(assetId);
        } catch (error) {
          props.pushNotification({
            tone: 'error',
            title: 'Erklärung fehlgeschlagen',
            message: error instanceof Error ? error.message : 'Unbekannter Fehler',
          });
        } finally {
          setLoading(false);
        }
      }}
      className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-50"
    >
      {loading ? 'Generiere…' : 'Erklärung generieren'}
    </button>
  );
}

function MasteryPill(props: { value: number }) {
  const value = Math.max(0, Math.min(1, props.value));
  const cls =
    value < 0.4
      ? 'border-rose-500/20 bg-rose-500/10 text-rose-200'
      : value < 0.7
        ? 'border-amber-500/20 bg-amber-500/10 text-amber-200'
        : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200';

  return (
    <span className={`rounded-full border px-3 py-1.5 text-sm font-medium ${cls}`}>
      {Math.round(value * 100)}%
    </span>
  );
}

function useChapterCards(input: {
  chapters: Chapter[];
  requirements: Requirement[];
  assets: Asset[];
}) {
  const [linkedTasksByRequirementId, setLinkedTasksByRequirementId] = useState<
    Record<string, Array<{ key: string; label: string; asset: Asset }>>
  >({});

  const requirementsKey = useMemo(
    () => input.requirements.map((r) => r.id).join('|'),
    [input.requirements],
  );
  const assetsKey = useMemo(() => input.assets.map((a) => a.id).join('|'), [input.assets]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (input.requirements.length === 0) {
        if (!cancelled) {
          setLinkedTasksByRequirementId((prev) => (Object.keys(prev).length ? {} : prev));
        }
        return;
      }

      const problemIds = new Set<string>();
      const subproblemIds = new Set<string>();
      const subsubproblemIds = new Set<string>();
      const allSubsubproblems = await db.subsubproblems.toArray();
      for (const subsubproblem of allSubsubproblems) {
        if ((subsubproblem.requirementIds ?? []).length > 0) {
          subsubproblemIds.add(subsubproblem.id);
          subproblemIds.add(subsubproblem.subproblemId);
        }
      }

      const allSubproblems = await db.subproblems.toArray();
      for (const subproblem of allSubproblems) {
        if ((subproblem.requirementIds ?? []).length > 0 || subproblemIds.has(subproblem.id)) {
          subproblemIds.add(subproblem.id);
          problemIds.add(subproblem.problemId);
        }
      }

      const allProblems = await db.problems.toArray();
      const problems = allProblems.filter(
        (problem) => (problem.requirementIds ?? []).length > 0 || problemIds.has(problem.id),
      );
      for (const problem of problems) problemIds.add(problem.id);
      const subproblems = allSubproblems.filter((subproblem) => subproblemIds.has(subproblem.id));
      const subsubproblems = allSubsubproblems.filter((subsubproblem) =>
        subsubproblemIds.has(subsubproblem.id),
      );
      const exercises = problems.length
        ? await db.exercises
            .where('id')
            .anyOf(problems.map((problem) => problem.exerciseId))
            .toArray()
        : [];

      const subproblemById = new Map(subproblems.map((entry) => [entry.id, entry]));
      const problemById = new Map(problems.map((entry) => [entry.id, entry]));
      const exerciseById = new Map(exercises.map((entry) => [entry.id, entry]));
      const assetById = new Map(input.assets.map((asset) => [asset.id, asset]));

      const next: Record<string, Array<{ key: string; label: string; asset: Asset }>> = {};
      const tasks = buildTaskRequirementMap({
        problems,
        subproblems,
        subsubproblems,
        problemById,
        subproblemById,
        exerciseById,
        assetById,
      });
      for (const requirement of input.requirements) {
        next[requirement.id] = tasks.get(requirement.id) ?? [];
      }
      if (!cancelled) {
        setLinkedTasksByRequirementId((prev) => (areLinkedTasksEqual(prev, next) ? prev : next));
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [assetsKey, requirementsKey]);

  return useMemo(
    () =>
      input.chapters.map((chapter) => {
        const chapterRequirements = input.requirements.filter(
          (requirement) => requirement.chapterId === chapter.id,
        );
        const mastery =
          chapterRequirements.length > 0
            ? chapterRequirements.reduce((sum, requirement) => sum + requirement.mastery, 0) /
              chapterRequirements.length
            : 0;
        return {
          chapter,
          mastery,
          requirements: chapterRequirements.map((requirement) => ({
            requirement,
            linkedTasks: linkedTasksByRequirementId[requirement.id] ?? [],
          })),
        };
      }),
    [input.chapters, input.requirements, linkedTasksByRequirementId],
  );
}

function areLinkedTasksEqual(
  prev: Record<string, Array<{ key: string; label: string; asset: Asset }>>,
  next: Record<string, Array<{ key: string; label: string; asset: Asset }>>,
) {
  const prevKeys = Object.keys(prev);
  const nextKeys = Object.keys(next);
  if (prevKeys.length !== nextKeys.length) return false;

  for (const requirementId of nextKeys) {
    const a = prev[requirementId] ?? [];
    const b = next[requirementId] ?? [];
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i]!.key !== b[i]!.key) return false;
      if (a[i]!.label !== b[i]!.label) return false;
      if (a[i]!.asset.id !== b[i]!.asset.id) return false;
    }
  }
  return true;
}

function buildTaskRequirementMap(input: {
  problems: Array<{ id: string; exerciseId: string; idx: number; requirementIds: string[] }>;
  subproblems: Array<{ id: string; problemId: string; label: string; requirementIds: string[] }>;
  subsubproblems: Array<{
    id: string;
    subproblemId: string;
    label: string;
    requirementIds: string[];
  }>;
  problemById: Map<string, { id: string; exerciseId: string; idx: number }>;
  subproblemById: Map<string, { id: string; problemId: string; label: string }>;
  exerciseById: Map<string, { id: string; assetId: string }>;
  assetById: Map<string, Asset>;
}) {
  const out = new Map<string, Array<{ key: string; label: string; asset: Asset }>>();

  for (const problem of input.problems) {
    const exercise = input.exerciseById.get(problem.exerciseId);
    const asset = exercise ? input.assetById.get(exercise.assetId) : undefined;
    if (!asset) continue;
    appendRequirementTasks(out, problem.requirementIds, {
      key: `${problem.id}::problem`,
      label: `Aufgabe ${problem.idx}`,
      asset,
    });
  }

  for (const subproblem of input.subproblems) {
    const problem = input.problemById.get(subproblem.problemId);
    const exercise = problem ? input.exerciseById.get(problem.exerciseId) : undefined;
    const asset = exercise ? input.assetById.get(exercise.assetId) : undefined;
    if (!problem || !asset) continue;
    const label = subproblem.label.trim()
      ? `Aufgabe ${problem.idx}.${subproblem.label.trim()}`
      : `Aufgabe ${problem.idx}`;
    appendRequirementTasks(out, subproblem.requirementIds, {
      key: `${subproblem.id}::subproblem`,
      label,
      asset,
    });
  }

  for (const subsubproblem of input.subsubproblems) {
    const subproblem = input.subproblemById.get(subsubproblem.subproblemId);
    const problem = subproblem ? input.problemById.get(subproblem.problemId) : undefined;
    const exercise = problem ? input.exerciseById.get(problem.exerciseId) : undefined;
    const asset = exercise ? input.assetById.get(exercise.assetId) : undefined;
    if (!problem || !subproblem || !asset) continue;
    const labelParts = [String(problem.idx)];
    if (subproblem.label.trim()) labelParts.push(subproblem.label.trim());
    if (subsubproblem.label.trim()) labelParts.push(subsubproblem.label.trim());
    appendRequirementTasks(out, subsubproblem.requirementIds, {
      key: `${subsubproblem.id}::subsubproblem`,
      label: `Aufgabe ${labelParts.join('.')}`,
      asset,
    });
  }

  return out;
}

function appendRequirementTasks(
  map: Map<string, Array<{ key: string; label: string; asset: Asset }>>,
  requirementIds: string[] | undefined,
  task: { key: string; label: string; asset: Asset },
) {
  for (const requirementId of requirementIds ?? []) {
    const current = map.get(requirementId) ?? [];
    current.push(task);
    map.set(requirementId, current);
  }
}
