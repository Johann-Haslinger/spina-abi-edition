import { LearnPathChatPanel } from './components/LearnPathChatPanel';
import { LearnPathOverview } from './components/LearnPathOverview';
import { LearnPathSidebar } from './components/LearnPathSidebar';
import { useLearnPathController } from './useLearnPathController';

export function TopicKnowledgePathView(props: {
  topicId: string;
  topicName?: string;
  subjectName?: string;
}) {
  const controller = useLearnPathController(props);

  if (controller.curriculumLoading && controller.groupedRequirements.length === 0) {
    return (
      <section className="mt-10 rounded-4xl border border-white/8 bg-white/4 p-6 text-sm text-white/60">
        Wissenspfad wird vorbereitet…
      </section>
    );
  }

  if (controller.curriculumError) {
    return (
      <section className="mt-10 rounded-4xl border border-rose-900/60 bg-rose-950/30 p-6 text-sm text-rose-200">
        {controller.curriculumError}
      </section>
    );
  }

  if (controller.groupedRequirements.length === 0) {
    return (
      <section className="mt-10 rounded-4xl border border-white/8 bg-white/4 p-6 text-sm text-white/60">
        Fuer dieses Thema gibt es noch keine Kapitel mit Requirements.
      </section>
    );
  }

  if (!controller.state.started) {
    if (controller.progressLoading) {
      return (
        <section className="mt-10 rounded-4xl border border-white/8 bg-white/4 p-6 text-sm text-white/60">
          Wissenspfad-Fortschritt wird geladen…
        </section>
      );
    }

    return (
      <LearnPathOverview
        items={controller.overviewItems}
        latestInProgress={controller.latestInProgress}
        firstOpenRequirement={controller.firstOpenRequirement}
        onResumeLatest={controller.handleResumeLatest}
        onStartRequirement={controller.handleStartOverviewItem}
      />
    );
  }

  return (
    <section className="pt-10">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <LearnPathChatPanel
          state={controller.state}
          mode={controller.state.mode}
          draft={controller.draft}
          totalChapters={controller.groupedRequirements.length}
          totalRequirements={controller.totalRequirements}
          currentRequirementPosition={controller.currentRequirementPosition}
          currentChapterName={controller.currentChapter?.name}
          currentRequirementName={controller.currentRequirement?.name}
          activePlan={controller.state.activePlan}
          activeStep={controller.activeStep}
          onDraftChange={controller.setDraft}
          onBack={controller.resetToOverview}
          onRestart={controller.handleRestart}
          onContinue={controller.handleContinue}
          onSend={controller.handleSend}
          onExerciseSubmit={controller.handleExerciseSubmit}
        />
        <LearnPathSidebar
          mode={controller.state.mode}
          activePlan={controller.state.activePlan}
          activeStep={controller.activeStep}
          currentRequirement={controller.currentRequirement}
          requirementGoal={controller.currentRequirementGoal}
          subjectName={props.subjectName}
          topicName={props.topicName}
          currentChapterName={controller.currentChapter?.name}
          currentRequirementName={controller.currentRequirement?.name}
        />
      </div>
    </section>
  );
}
