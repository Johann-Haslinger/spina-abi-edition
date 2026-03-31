import { IoChevronBack } from 'react-icons/io5';
import { ViewerIconButton } from '../../../../components/ViewerIconButton';
import { LearnPathChatPanel } from './components/LearnPathChatPanel';
import { LearnPathOverview } from './components/LearnPathOverview';
import { useLearnPathController } from './useLearnPathController';

export function TopicKnowledgePathView(props: {
  subjectId: string;
  topicId: string;
  topicName?: string;
  subjectName?: string;
  onBackToTopic: () => void;
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
      <>
        <ViewerIconButton
          ariaLabel="Zurück zum Thema"
          onClick={props.onBackToTopic}
          className="fixed left-6 top-6 z-[60]"
        >
          <IoChevronBack />
        </ViewerIconButton>
        <div className="px-6">
          <LearnPathOverview
            items={controller.overviewItems}
            latestInProgress={controller.latestInProgress}
            firstOpenRequirement={controller.firstOpenRequirement}
            onResumeLatest={controller.handleResumeLatest}
            onStartRequirement={controller.handleStartOverviewItem}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <LearnPathChatPanel
        state={controller.state}
        mode={controller.state.mode}
        subjectId={props.subjectId}
        draft={controller.draft}
        totalChapters={controller.groupedRequirements.length}
        totalRequirements={controller.totalRequirements}
        currentRequirementPosition={controller.currentRequirementPosition}
        subjectName={props.subjectName}
        topicName={props.topicName}
        currentChapterName={controller.currentChapter?.name}
        currentRequirementName={controller.currentRequirement?.name}
        activePlan={controller.state.activePlan}
        activeStep={controller.activeStep}
        overviewItems={controller.overviewItems}
        onDraftChange={controller.setDraft}
        onBack={controller.resetToOverview}
        onContinue={controller.handleContinue}
        onSend={controller.handleSend}
        onExerciseSubmit={controller.handleExerciseSubmit}
        onStartRequirement={controller.handleStartOverviewItem}
        onPanelOpenChange={controller.setPanelOpen}
        onPanelViewChange={controller.setPanelView}
      />
    </>
  );
}
