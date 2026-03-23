import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotificationsStore } from '../stores/notificationsStore';

export function NotificationCenter() {
  const navigate = useNavigate();
  const notifications = useNotificationsStore((state) => state.notifications);
  const dismiss = useNotificationsStore((state) => state.dismiss);
  const push = useNotificationsStore((state) => state.push);
  const openAttemptReview = useNotificationsStore((state) => state.openAttemptReview);
  const [expandedNotificationId, setExpandedNotificationId] = useState<string | null>(null);

  useEffect(() => {
    push({
      tone: 'success',
      title: 'KI-Bewertung abgeschlossen',
      message: 'Die Aufgabe wurde richtig gelost.',
      details: {
        kind: 'attemptReviewSuccess',
        score: 0.94,
        messageToUser: 'Sehr gut. Der Rechenweg ist stimmig und das Ergebnis korrekt.',
        solutionExplanation:
          'Du hast die richtigen Schritte in der passenden Reihenfolge verwendet und sauber zum Endergebnis gefuhrt.',
        requirementUpdates: [
          {
            requirementId: 'preview-1',
            requirementName: 'Quadratische Gleichungen losen',
            masteryDelta: 0.12,
          },
          {
            requirementId: 'preview-2',
            requirementName: 'Terme umformen',
            masteryDelta: 0.08,
          },
          {
            requirementId: 'preview-3',
            requirementName: 'Vorzeichenfehler vermeiden',
            masteryDelta: 0.05,
          },
        ],
      },
    });
  }, [push]);

  const activeExpandedNotificationId = notifications.some(
    (notification) => notification.id === expandedNotificationId,
  )
    ? expandedNotificationId
    : null;

  useEffect(() => {
    const timers = notifications
      .filter((notification) => notification.id !== activeExpandedNotificationId)
      .map((notification) =>
        window.setTimeout(
          () => dismiss(notification.id),
          notification.details?.kind === 'attemptReviewSuccess' ? 12000 : 7000,
        ),
      );
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [activeExpandedNotificationId, dismiss, notifications]);

  return (
    <div className="pointer-events-none fixed top-4 left-1/2 z-10000 flex w-full max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-col items-center gap-3">
      <AnimatePresence initial={false} mode="popLayout">
        {notifications.map((notification) => {
          const successDetails =
            notification.details?.kind === 'attemptReviewSuccess' ? notification.details : null;
          const isExpandedSuccess =
            Boolean(successDetails) && activeExpandedNotificationId === notification.id;
          return (
            <motion.div
              key={notification.id}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.97, height: 0, marginTop: 0, marginBottom: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <motion.button
                type="button"
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 42 }}
                onClick={() => {
                  if (successDetails) {
                    setExpandedNotificationId((current) =>
                      current === notification.id ? null : notification.id,
                    );
                    return;
                  }
                  if (notification.action?.kind === 'openAttemptReview') {
                    openAttemptReview({
                      subjectId: notification.action.subjectId,
                      topicId: notification.action.topicId,
                      assetId: notification.action.assetId,
                      attemptId: notification.action.attemptId,
                    });
                    navigate(
                      `/subjects/${notification.action.subjectId}/topics/${notification.action.topicId}/${notification.action.assetId}`,
                    );
                  }
                  dismiss(notification.id);
                }}
                className={`pointer-events-auto flex rounded-3xl border border-white/10 bg-[#243957]/80 text-left shadow-lg backdrop-blur ${
                  isExpandedSuccess
                    ? 'w-120 max-w-[calc(100vw-1rem)] items-start gap-3 px-5 py-5'
                    : 'w-104 max-w-[calc(100vw-1rem)] items-center'
                }`}
              >
                <div className={isExpandedSuccess ? 'min-w-0 flex-1' : 'px-3 py-3 pr-4'}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold">{notification.title}</div>
                      {successDetails ? (
                        <div className="mt-1 text-sm text-white/75">
                          {successDetails.messageToUser ||
                            notification.message ||
                            'Die Aufgabe wurde erfolgreich bewertet.'}
                        </div>
                      ) : notification.message ? (
                        <div className="mt-1 text-sm text-white/75">{notification.message}</div>
                      ) : null}
                    </div>

                    {successDetails ? (
                      <div className="shrink-0 rounded-full border border-[#00AE27]/10 bg-[#00AE27]/10 px-2.5 py-1 text-xs text-white">
                        {formatPercent(successDetails.score)}
                      </div>
                    ) : null}
                  </div>

                  <AnimatePresence initial={false}>
                    {isExpandedSuccess ? (
                      <motion.div
                        key="expanded-success-content"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        {successDetails?.solutionExplanation ? (
                          <div className="mt-3 rounded-2xl border border-[#00AE27]/10 bg-[#00AE27]/10 px-3 py-2 text-sm text-white whitespace-pre-wrap">
                            {successDetails.solutionExplanation}
                          </div>
                        ) : null}

                        {successDetails?.requirementUpdates.length ? (
                          <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                            <div className="text-xs font-semibold uppercase tracking-wide text-white/50">
                              Fortschritt in Requirements
                            </div>
                            <div className="mt-2 space-y-2">
                              {successDetails.requirementUpdates.map((update) => (
                                <div
                                  key={`${notification.id}:${update.requirementId}`}
                                  className="flex items-center justify-between gap-3 text-sm"
                                >
                                  <div className="min-w-0 text-white/85">
                                    {update.requirementName}
                                  </div>
                                  <div className="shrink-0 text-[#00AE27]/80">
                                    {formatDelta(update.masteryDelta)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </motion.div>
                    ) : null}
                  </AnimatePresence>

                  {successDetails ? (
                    <div className="mt-2 text-xs font-medium text-white/55">
                      {isExpandedSuccess ? 'Tippen zum Einklappen' : 'Tippen fur Details'}
                    </div>
                  ) : null}

                  {notification.action ? (
                    <div className="mt-2 text-xs font-medium text-white/55">Tippen zum Öffnen</div>
                  ) : null}
                </div>
              </motion.button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDelta(value: number) {
  const percentage = Math.abs(value) * 100;
  const rounded = Number.isInteger(percentage) ? percentage.toFixed(0) : percentage.toFixed(1);
  return `${value >= 0 ? '+' : '-'}${rounded}%`;
}
