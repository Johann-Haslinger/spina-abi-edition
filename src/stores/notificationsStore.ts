import { create } from 'zustand';

type AttemptReviewSuccessDetails = {
  kind: 'attemptReviewSuccess';
  score: number;
  messageToUser?: string;
  notes?: string;
  solutionExplanation?: string;
  requirementUpdates: Array<{
    requirementId: string;
    requirementName: string;
    masteryDelta: number;
  }>;
};

export type AppNotification = {
  id: string;
  title: string;
  message?: string;
  tone?: 'info' | 'success' | 'warning' | 'error';
  details?: AttemptReviewSuccessDetails;
  action?:
    | {
        kind: 'openAttemptReview';
        subjectId: string;
        topicId: string;
        assetId: string;
        attemptId: string;
      }
    | undefined;
  createdAtMs: number;
};

type NotificationsState = {
  notifications: AppNotification[];
  activeAttemptReview: {
    subjectId: string;
    topicId: string;
    assetId: string;
    attemptId: string;
  } | null;
  /** True while AiErrorReviewPanel actually shows review content (not loading). */
  attemptReviewPanelOpen: boolean;
  push: (input: Omit<AppNotification, 'id' | 'createdAtMs'>) => void;
  dismiss: (id: string) => void;
  openAttemptReview: (input: {
    subjectId: string;
    topicId: string;
    assetId: string;
    attemptId: string;
  }) => void;
  closeAttemptReview: () => void;
  setAttemptReviewPanelOpen: (open: boolean) => void;
};

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  activeAttemptReview: null,
  attemptReviewPanelOpen: false,
  push: (input) =>
    set((state) => ({
      notifications: [
        {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          createdAtMs: Date.now(),
          tone: input.tone ?? 'info',
          title: input.title,
          message: input.message,
          details: input.details,
          action: input.action,
        },
        ...state.notifications,
      ].slice(0, 5),
    })),
  dismiss: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((notification) => notification.id !== id),
    })),
  openAttemptReview: (input) => set({ activeAttemptReview: input }),
  closeAttemptReview: () => set({ activeAttemptReview: null, attemptReviewPanelOpen: false }),
  setAttemptReviewPanelOpen: (open) => set({ attemptReviewPanelOpen: open }),
}));
