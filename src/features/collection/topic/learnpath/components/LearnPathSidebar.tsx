import type { LearnPathMode, Requirement } from '../../../../../domain/models';
import { getPlanStepPosition } from '../learnPathUtils';
import type { RequirementPlan, RequirementPlanStep } from '../types';

export function LearnPathSidebar(props: {
  mode: LearnPathMode | null;
  activePlan: RequirementPlan | null;
  activeStep?: RequirementPlanStep;
  currentRequirement?: Requirement;
  requirementGoal: string;
  subjectName?: string;
  topicName?: string;
  currentChapterName?: string;
  currentRequirementName?: string;
}) {
  const currentStepPosition = getPlanStepPosition(props.activePlan, props.activeStep?.id ?? null);

  return (
    <aside className="space-y-4">
      <div className="rounded-3xl border border-white/8 bg-slate-950/25 p-4">
        <div className="text-xs uppercase tracking-wide text-white/45">Fahrplan</div>
        {props.mode ? (
          <div className="mt-2 text-sm text-white/65">
            {props.mode === 'learn' ? 'Lernmodus' : 'Wiederholmodus'}
          </div>
        ) : null}
        {props.activePlan ? (
          <div className="mt-3 space-y-3">
            <div className="text-sm text-white/75">
              Aktiver Schritt {currentStepPosition} von {props.activePlan.steps.length}
            </div>
            <div className="space-y-2">
              {props.activePlan.steps.map((step, index) => {
                const isActive = step.id === props.activeStep?.id;
                return (
                  <div
                    key={step.id}
                    className={`rounded-2xl border px-3 py-3 text-sm ${
                      isActive
                        ? 'border-cyan-400/30 bg-cyan-500/10 text-white'
                        : 'border-white/8 bg-white/5 text-white/75'
                    }`}
                  >
                    <div className="text-xs uppercase tracking-wide text-white/45">
                      Schritt {index + 1}
                    </div>
                    <div className="mt-1 font-medium">{step.title}</div>
                    <div className="mt-1 text-xs text-white/50">
                      {step.type}
                      {step.exerciseType ? ` · ${step.exerciseType}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="mt-3 text-sm text-white/60">Der AI-Fahrplan wird gerade erstellt.</div>
        )}
      </div>

      <div className="rounded-3xl border border-white/8 bg-slate-950/25 p-4">
        <div className="text-xs uppercase tracking-wide text-white/45">Kontext</div>
        <div className="mt-3 space-y-3 text-sm text-white/80">
          <div>
            <div className="text-white/45">Fach</div>
            <div className="mt-1">{props.subjectName ?? '–'}</div>
          </div>
          <div>
            <div className="text-white/45">Thema</div>
            <div className="mt-1">{props.topicName ?? '–'}</div>
          </div>
          <div>
            <div className="text-white/45">Kapitel</div>
            <div className="mt-1">{props.currentChapterName ?? '–'}</div>
          </div>
          <div>
            <div className="text-white/45">Requirement</div>
            <div className="mt-1">{props.currentRequirementName ?? '–'}</div>
          </div>
          <div>
            <div className="text-white/45">Requirement Goal</div>
            <div className="mt-1">{props.currentRequirement ? props.requirementGoal : '–'}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
