import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { DashboardPage } from './features/dashboard'
import { NotFoundPage } from './features/common'
import { SubjectPage, TopicPage } from './features/collection'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/subjects/:subjectId" element={<SubjectPage />} />
        <Route
          path="/subjects/:subjectId/topics/:topicId"
          element={<TopicPage />}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
