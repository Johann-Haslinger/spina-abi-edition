import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ListTree, X } from 'lucide-react';
import type { LearnPathMode } from '../../../../../domain/models';
import type { LearnPathPanelView, LearnPathRequirementOverviewItem, RequirementPlan, RequirementPlanStep } from '../types';
import { getPlanStepPosition } from '../learnPathUtils';

export function LearnPathOverviewPanel(props: {
  open: boolean;
  view: LearnPathPanelView;
  mode: LearnPathMode | null;
  subjectName?: string;
  topicName?: string;
  currentChapterName?: string;
  currentRequirementName?: string;
  activePlan: RequirementPlan | null;
  activeStep?: RequirementPlanStep;
  overviewItems: LearnPathRequirementOverviewItem[];
  onClose: () => void;
  onBackToOverview: () => void;
  onShowCurrentRequirement: () => void;
  onStartRequirement: (item: LearnPathRequirementOverviewItem, mode: LearnPathMode) => void;
}) {
  const currentStepPosition = getPlanStepPosition(props.activePlan, props.activeStep?.id ?? null);

  return (
    <AnimatePresence>
      {props.open ? (
        <motion.div
          className="pointer-events-auto absolute inset-x-0 bottom-24 z-30 px-4 sm:px-6"
          initial={{ opacity: 0, y: 18, scale: 0.96, transformOrigin: 'left bottom' }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
        >
          <div className="max-w-[420px] rounded-[30px] border border-white/10 bg-slate-950/92 p-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-[0.22em] text-white/40">Requirement</div>
                <div className="mt-1 truncate text-lg font-semibold text-white">
                  {props.currentRequirementName ?? 'Wissenspfad'}
                </div>
                <div className="mt-1 text-sm text-white/55">
                  {[props.topicName, props.currentChapterName].filter(Boolean).join(' · ') || 'Ohne Kontext'}
                </div>
              </div>
              <button
                type="button"
                onClick={props.onClose}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/75 hover:bg-white/10 hover:text-white"
                aria-label="Panel schliessen"
              >
                <X className="size-4" />
              </button>
            </div>

            {props.view === 'current_requirement' ? (
              <div className="mt-4 space-y-4">
                <button
                  type="button"
                  onClick={props.onBackToOverview}
                  className="inline-flex items-center gap-2 rounded-xl px-2 py-1 text-sm text-white/70 hover:bg-white/6 hover:text-white"
                >
                  <ChevronLeft className="size-4" />
                  Alle Requirements
                </button>

                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-wide text-white/45">Modus</div>
                  <div className="mt-1 text-sm text-white/85">
                    {props.mode === 'review' ? 'Wiederholmodus' : 'Lernmodus'}
                  </div>
                  <div className="mt-3 text-xs uppercase tracking-wide text-white/45">Fahrplan</div>
                  {props.activePlan ? (
                    <div className="mt-3 space-y-2">
                      <div className="text-sm text-white/65">
                        Schritt {currentStepPosition} von {props.activePlan.steps.length}
                      </div>
                      {props.activePlan.steps.map((step, index) => {
                        const isActive = step.id === props.activeStep?.id;
                        return (
                          <div
                            key={step.id}
                            className={`rounded-2xl border px-3 py-3 ${
                              isActive
                                ? 'border-cyan-300/30 bg-cyan-400/10 text-white'
                                : 'border-white/8 bg-slate-950/55 text-white/75'
                            }`}
                          >
                            <div className="text-[11px] uppercase tracking-wide text-white/45">
                              Schritt {index + 1}
                            </div>
                            <div className="mt-1 text-sm font-medium">{step.title}</div>
                            <div className="mt-1 text-xs text-white/45">
                              {step.type}
                              {step.exerciseType ? ` · ${step.exerciseType}` : ''}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-3 text-sm text-white/60">Der AI-Fahrplan wird gerade erstellt.</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <button
                  type="button"
                  onClick={props.onShowCurrentRequirement}
                  className="inline-flex items-center gap-2 rounded-xl px-2 py-1 text-sm text-white/70 hover:bg-white/6 hover:text-white"
                >
                  <ListTree className="size-4" />
                  Aktuelles Requirement
                </button>
                <div className="max-h-[56vh] space-y-3 overflow-y-auto pr-1">
                  {props.overviewItems.map((item) => {
                    const learnCompleted = item.learnProgress?.status === 'completed';
                    const canResumeLearn = item.learnProgress?.status === 'in_progress';
                    const canResumeReview = item.reviewProgress?.status === 'in_progress';
                    const canReview = learnCompleted;

                    return (
                      <div key={item.requirement.id} className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                        <div className="text-xs uppercase tracking-wide text-white/45">{item.chapter.name}</div>
                        <div className="mt-1 text-sm font-medium text-white">{item.requirement.name}</div>
                        <div className="mt-2 text-xs text-white/55">{labelForStatus(item.status)}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {canResumeLearn ? (
                            <PanelActionButton onClick={() => props.onStartRequirement(item, 'learn')}>
                              Lernen fortsetzen
                            </PanelActionButton>
                          ) : !learnCompleted ? (
                            <PanelActionButton onClick={() => props.onStartRequirement(item, 'learn')}>
                              Lernen
                            </PanelActionButton>
                          ) : null}
                          {canResumeReview ? (
                            <PanelActionButton secondary onClick={() => props.onStartRequirement(item, 'review')}>
                              Wiederholung fortsetzen
                            </PanelActionButton>
                          ) : canReview ? (
                            <PanelActionButton secondary onClick={() => props.onStartRequirement(item, 'review')}>
                              Wiederholen
                            </PanelActionButton>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function PanelActionButton(props: {
  children: string;
  onClick: () => void;
  secondary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`rounded-xl border px-3 py-2 text-sm ${
        props.secondary
          ? 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
          : 'border-cyan-300/20 bg-cyan-400/10 text-cyan-50 hover:bg-cyan-400/15'
      }`}
    >
      {props.children}
    </button>
  );
}

function labelForStatus(status: LearnPathRequirementOverviewItem['status']) {
  if (status === 'completed') return 'Abgehakt';
  if (status === 'reviewing') return 'Wiederholung laeuft';
  if (status === 'in_progress') return 'In Bearbeitung';
  return 'Offen';
}
