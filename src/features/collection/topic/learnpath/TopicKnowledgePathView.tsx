import { ActionDialog } from '../../../../components/ActionDialog';
import { LearnPathChatPanel } from './components/LearnPathChatPanel';
import { LearnPathOverview } from './components/LearnPathOverview';
import { useLearnPathController } from './useLearnPathController';

export function TopicKnowledgePathView(props: {
  subjectId: string;
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
      <ActionDialog
        open={controller.leaveDialogOpen}
        onClose={() => controller.setLeaveDialogOpen(false)}
        busy={controller.leaveDialogBusy}
        title="Lernpfad verlassen?"
        message="Du kannst die Seite einfach verlassen und spaeter weitermachen oder die aktuelle Session beenden und direkt auswerten."
        actions={[
          {
            key: 'leave',
            label: 'Seite verlassen',
            tone: 'neutral',
            onClick: controller.handleLeavePage,
          },
          {
            key: 'end',
            label: 'Session beenden',
            tone: 'primary',
            onClick: controller.handleEndSession,
          },
          {
            key: 'cancel',
            label: 'Abbrechen',
            tone: 'neutral',
            onClick: () => controller.setLeaveDialogOpen(false),
          },
        ]}
      />
      <LearnPathChatPanel
        state={controller.state}
        mode={controller.state.mode}
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
        onBack={controller.handleBack}
        onRestart={controller.handleRestart}
        onContinue={controller.handleContinue}
        onSend={controller.handleSend}
        onExerciseSubmit={controller.handleExerciseSubmit}
        onStartRequirement={controller.handleStartOverviewItem}
        onPanelOpenChange={controller.setPanelOpen}
        onPanelViewChange={controller.setPanelView}
      />
    </section>
  );
}
