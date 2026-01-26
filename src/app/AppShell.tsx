import { Outlet } from 'react-router-dom'
import { ActiveSessionBanner } from '../features/session'
import { NavBar } from './NavBar'


export function AppShell() {
  return (
    <div className="min-h-screen">
      <NavBar />

      <main className="mx-auto max-w-6xl px-4 py-6">
        <ActiveSessionBanner />
        <Outlet />
      </main>
    </div>
  )
}



