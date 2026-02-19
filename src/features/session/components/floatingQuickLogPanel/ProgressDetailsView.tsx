import { useEffect, useMemo, useState } from 'react';
import { FiMinimize2 } from 'react-icons/fi';
import { IoCheckmark } from 'react-icons/io5';
import { GhostButton, PrimaryButton, SecondaryButton } from '../../../../components/Button';
import { formatDurationClock } from '../../../../utils/time';
import { useStudyStore } from '../../stores/studyStore';
import { PanelViewHeader, type DragGripProps } from './PanelViewHeader';

export function ProgressDetailsView(props: {
  gripProps: DragGripProps;
  onFinish: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const currentAttempt = useStudyStore((s) => s.currentAttempt);
  const pastSeconds = usePastTimeInSeconds();

  return (
    <div className="h-full flex flex-col">
      <PanelViewHeader left={<GhostButton onClick={props.onClose} icon={<FiMinimize2 />} />} />

      <div className="flex flex-col mt-3 items-center">
        <span className="tabular-nums text-4xl font-medium">
          {formatDurationClock(pastSeconds)}
        </span>
        <span className="text-base mt-2 opacity-70">
          Aufgabe {currentAttempt?.problemIdx} {currentAttempt?.subproblemLabel}
        </span>
      </div>

      <div className="mt-auto pt-4 flex justify-end gap-2">
        <SecondaryButton onClick={props.onCancel}>Abbrechen</SecondaryButton>
        <PrimaryButton icon={<IoCheckmark />} onClick={props.onFinish} />
      </div>
    </div>
  );
}

const usePastTimeInSeconds = () => {
  const currentAttempt = useStudyStore((s) => s.currentAttempt);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!currentAttempt) return;
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [currentAttempt]);

  const seconds = useMemo(() => {
    if (!currentAttempt) return 0;
    return Math.max(0, Math.floor((nowMs - currentAttempt.startedAtMs) / 1000));
  }, [nowMs, currentAttempt]);

  return seconds;
};
