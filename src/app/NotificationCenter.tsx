import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { retryAttemptReviewFromNotification } from '../features/session/review/processAttemptReview';
import { useNotificationsStore } from '../stores/notificationsStore';

export function NotificationCenter() {
  const navigate = useNavigate();
  const notifications = useNotificationsStore((state) => state.notifications);
  const dismiss = useNotificationsStore((state) => state.dismiss);
  const openAttemptReview = useNotificationsStore((state) => state.openAttemptReview);
  const pushNotification = useNotificationsStore((state) => state.push);
  const [expandedNotificationId, setExpandedNotificationId] = useState<string | null>(null);
  const [collapsedAtMsById, setCollapsedAtMsById] = useState<Record<string, number>>({});
  const [retryingNotificationId, setRetryingNotificationId] = useState<string | null>(null);

  const activeExpandedNotificationId = notifications.some(
    (notification) => notification.id === expandedNotificationId,
  )
    ? expandedNotificationId
    : null;

  useEffect(() => {
    const timers = notifications
      .filter(
        (notification) =>
          notification.id !== activeExpandedNotificationId &&
          notification.id !== retryingNotificationId,
      )
      .map((notification) =>
        window.setTimeout(
          () => dismiss(notification.id),
          (() => {
            const defaultDelayMs =
              notification.details?.kind === 'attemptReviewSuccess' ? 12000 : 7000;
            const collapsedAtMs = collapsedAtMsById[notification.id];
            if (typeof collapsedAtMs === 'number') {
              const elapsedMs = Date.now() - collapsedAtMs;
              return Math.max(0, 3000 - elapsedMs);
            }
            return defaultDelayMs;
          })(),
        ),
      );
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [
    activeExpandedNotificationId,
    dismiss,
    notifications,
    collapsedAtMsById,
    retryingNotificationId,
  ]);

  const openNotificationAction = (notification: (typeof notifications)[number]) => {
    if (notification.action?.kind !== 'openAttemptReview') return;
    openAttemptReview({
      subjectId: notification.action.subjectId,
      topicId: notification.action.topicId,
      assetId: notification.action.assetId,
      attemptId: notification.action.attemptId,
    });
    navigate(
      `/subjects/${notification.action.subjectId}/topics/${notification.action.topicId}/${notification.action.assetId}`,
    );
  };

  const retryNotificationAction = async (notification: (typeof notifications)[number]) => {
    if (notification.action?.kind !== 'retryAttemptReview') return;
    setRetryingNotificationId(notification.id);
    try {
      await retryAttemptReviewFromNotification(notification.action);
      dismiss(notification.id);
    } catch (error) {
      pushNotification({
        tone: 'error',
        title: 'Erneuter Versuch fehlgeschlagen',
        message:
          error instanceof Error
            ? error.message
            : 'Die KI-Bewertung konnte nicht neu gestartet werden.',
      });
    } finally {
      setRetryingNotificationId((current) => (current === notification.id ? null : current));
    }
  };

  return (
    <div className="pointer-events-none fixed top-4 left-1/2 z-10000 flex w-full max-w-[calc(100vw-1rem)] -translate-x-1/2 flex-col items-center gap-3">
      <AnimatePresence initial={false} mode="popLayout">
        {notifications.map((notification) => {
          const successDetails =
            notification.details?.kind === 'attemptReviewSuccess' ? notification.details : null;
          const retryAction =
            notification.action?.kind === 'retryAttemptReview' ? notification.action : null;
          const hasOpenAction = notification.action?.kind === 'openAttemptReview';
          const bodyText = successDetails
            ? successDetails.messageToUser ||
              notification.message ||
              'Die Aufgabe wurde erfolgreich bewertet.'
            : notification.message;
          const hasExtraSuccessContent = Boolean(
            successDetails &&
            (successDetails.solutionExplanation || successDetails.requirementUpdates.length > 0),
          );
          const messageNeedsClamp =
            Boolean(bodyText) && (bodyText!.length > 85 || (bodyText?.includes('\n') ?? false));
          const canExpand = Boolean(successDetails && hasExtraSuccessContent) || messageNeedsClamp;

          const isExpanded = activeExpandedNotificationId === notification.id;
          const isRetrying = retryingNotificationId === notification.id;
          const content = (
            <div className={isExpanded ? 'min-w-0 flex-1' : 'px-3 py-3 pr-4'}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{notification.title}</div>
                  {bodyText ? (
                    <div
                      className={`mt-1 text-sm text-white/75 whitespace-pre-wrap ${
                        !isExpanded ? 'line-clamp-2' : ''
                      }`}
                    >
                      {bodyText}
                    </div>
                  ) : null}
                </div>

                {successDetails ? (
                  <div className="shrink-0 rounded-full border border-[#00AE27]/10 bg-[#00AE27]/10 px-2.5 py-1 text-xs text-white">
                    Gesamt {formatMasteryDeltaSum(successDetails.requirementUpdates)}
                  </div>
                ) : null}
              </div>

              <AnimatePresence initial={false}>
                {isExpanded && successDetails && hasExtraSuccessContent ? (
                  <motion.div
                    key="expanded-success-content"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    {successDetails.solutionExplanation ? (
                      <div className="mt-3 rounded-2xl border border-[#00AE27]/10 bg-[#00AE27]/10 px-3 py-2 text-sm text-white whitespace-pre-wrap">
                        {successDetails.solutionExplanation}
                      </div>
                    ) : null}

                    {successDetails.requirementUpdates.length ? (
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
                              <div className="min-w-0 text-white/85">{update.requirementName}</div>
                              <div className="shrink-0 text-[#00AE27]/80 tabular-nums">
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

              {canExpand ? (
                <div className="mt-2 text-xs font-medium text-white/55">
                  {isExpanded ? 'Tippen zum Einklappen' : 'Tippen für Details'}
                </div>
              ) : null}

              {hasOpenAction && !canExpand ? (
                <div className="mt-2 text-xs font-medium text-white/55">Tippen zum Öffnen</div>
              ) : null}
            </div>
          );

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
              <motion.div
                layout
                transition={{ type: 'spring', stiffness: 500, damping: 42 }}
                className={`pointer-events-auto flex rounded-3xl border border-white/10 text-left shadow-lg backdrop-blur ${
                  isExpanded
                    ? 'w-120 max-w-[calc(100vw-1rem)] flex-col items-start gap-3 px-5 py-5'
                    : 'w-104 max-w-[calc(100vw-1rem)] items-center'
                }`}
                style={{ backgroundColor: 'var(--app-floating-bg)' }}
              >
                {canExpand || hasOpenAction ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (canExpand) {
                        if (isExpanded) {
                          setCollapsedAtMsById((prev) => ({
                            ...prev,
                            [notification.id]: Date.now(),
                          }));
                        }
                        setExpandedNotificationId((current) =>
                          current === notification.id ? null : notification.id,
                        );
                        return;
                      }
                      openNotificationAction(notification);
                      dismiss(notification.id);
                    }}
                    className="w-full text-left"
                  >
                    {content}
                  </button>
                ) : (
                  <div className="w-full">{content}</div>
                )}

                {retryAction ? (
                  <div className={isExpanded ? 'flex w-full gap-2' : 'flex w-full gap-2 px-3 pb-3'}>
                    <button
                      type="button"
                      onClick={() => void retryNotificationAction(notification)}
                      disabled={isRetrying}
                      className="flex-1 rounded-full bg-white/90 px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
                    >
                      {isRetrying ? 'Wird gestartet...' : 'Erneut versuchen'}
                    </button>
                    <button
                      type="button"
                      onClick={() => dismiss(notification.id)}
                      disabled={isRetrying}
                      className="rounded-full bg-white/8 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Schließen
                    </button>
                  </div>
                ) : null}
              </motion.div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function formatDelta(value: number) {
  const percentage = Math.abs(value) * 100;
  const rounded = Number.isInteger(percentage) ? percentage.toFixed(0) : percentage.toFixed(1);
  return `${value >= 0 ? '+' : '-'}${rounded}%`;
}

function formatMasteryDeltaSum(
  updates: Array<{
    masteryDelta: number;
  }>,
) {
  return formatDelta(updates.reduce((sum, update) => sum + update.masteryDelta, 0));
}
