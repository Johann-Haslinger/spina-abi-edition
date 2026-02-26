import { useActiveSessionStore } from '../../stores/activeSessionStore'
import { useStudyHudVisibility } from './stores/studyHudStore'
import { ActiveSessionWidget } from './sessionWidget/ActiveSessionWidget'
import { NoActiveSessionWidget } from './sessionWidget/NoActiveSessionWidget'

export function SessionWidget() {
  const { active } = useActiveSessionStore()
  const { suppressNonStudyAi } = useStudyHudVisibility()
  if (active) return <ActiveSessionWidget active={active} hidden={suppressNonStudyAi} />
  return <NoActiveSessionWidget />
}
