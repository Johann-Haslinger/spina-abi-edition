import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './app/AppShell'
import { AssetPage, CollectionPage, SubjectPage, TopicPage } from './features/collection'
import { NotFoundPage } from './features/common'
import { DashboardPage } from './features/dashboard'
import { StudyPage } from './features/session'

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/collection" element={<CollectionPage />} />
        <Route path="/subjects/:subjectId" element={<SubjectPage />} />
        <Route
          path="/subjects/:subjectId/topics/:topicId"
          element={<TopicPage />}
        />
        <Route path="/assets/:assetId" element={<AssetPage />} />
        <Route path="/study/:assetId" element={<StudyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
