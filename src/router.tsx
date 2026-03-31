import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from './app/AppShell';
import { LastVisitedRedirect } from './app/LastVisitedRedirect';
import {
  AssetPage,
  CollectionPage,
  SubjectPage,
  TopicFlashcardsPage,
  TopicLearnPathPage,
  TopicPage,
} from './features/collection';
import { NotFoundPage } from './features/common';
import { DashboardPage } from './features/dashboard';
import { StudyPage } from './features/session';
import { PlanningPage } from './features/planning';

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <LastVisitedRedirect /> },
      { path: '/dashboard', element: <DashboardPage />, handle: { crumb: 'dashboard' } },
      { path: '/planning', element: <PlanningPage />, handle: { crumb: 'planning' } },
      { path: '/collection', element: <CollectionPage />, handle: { crumb: 'collection' } },
      { path: '/subjects/:subjectId', element: <SubjectPage />, handle: { crumb: 'subject' } },
      {
        path: '/subjects/:subjectId/topics/:topicId',
        element: <TopicPage />,
        handle: { crumb: 'topic' },
      },
      {
        path: '/subjects/:subjectId/topics/:topicId/learnpath',
        element: <TopicLearnPathPage />,
        handle: { crumb: 'topic' },
      },
      {
        path: '/subjects/:subjectId/topics/:topicId/flashcards',
        element: <TopicFlashcardsPage />,
        handle: { crumb: 'topic' },
      },
      {
        path: '/subjects/:subjectId/topics/:topicId/:assetId',
        element: <AssetPage />,
        handle: { crumb: 'asset' },
      },
      { path: '/assets/:assetId', element: <AssetPage />, handle: { crumb: 'asset' } },
      { path: '/study/:assetId', element: <StudyPage />, handle: { crumb: 'study' } },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
