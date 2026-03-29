import { useActiveSessionStore } from '../../stores/activeSessionStore';
import { useNotificationsStore } from '../../stores/notificationsStore';
import { ActiveSessionWidget } from './sessionWidget/ActiveSessionWidget';
import { useStudyHudVisibility } from './stores/studyHudStore';

export function SessionWidget() {
  const { active } = useActiveSessionStore();
  const { suppressNonStudyAi } = useStudyHudVisibility();
  const attemptReviewPanelOpen = useNotificationsStore((s) => s.attemptReviewPanelOpen);
  if (active)
    return (
      <ActiveSessionWidget
        active={active}
        hidden={suppressNonStudyAi || attemptReviewPanelOpen}
        offscreenMode={attemptReviewPanelOpen ? 'review' : suppressNonStudyAi ? 'studyAi' : null}
      />
    );
  return null;
}
