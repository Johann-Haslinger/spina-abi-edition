import { Outlet } from 'react-router-dom'
import { NavBar } from './NavBar'


export function AppShell() {
  return (
    <div className="min-h-screen">
      <NavBar />

      <main className="mx-auto max-w-4xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}



