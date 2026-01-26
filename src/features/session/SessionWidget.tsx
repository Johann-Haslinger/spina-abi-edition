import { useActiveSessionStore } from '../../stores/activeSessionStore'
import { ActiveSessionWidget } from './sessionWidget/ActiveSessionWidget'
import { NoActiveSessionWidget } from './sessionWidget/NoActiveSessionWidget'

export function SessionWidget() {
  const { active } = useActiveSessionStore()
  if (active) return <ActiveSessionWidget active={active} />
  return <NoActiveSessionWidget />
}
