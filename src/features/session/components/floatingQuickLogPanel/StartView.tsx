import { Info, Minus, Plus } from 'lucide-react';
import { PrimaryButton, SecondaryButton } from '../../../../components/Button';
import { useStudyStore } from '../../stores/studyStore';
import { PanelViewHeader, type DragGripProps } from './PanelViewHeader';
import { HighlightText, MutedText, PanelHeading } from './TextHighlight';

export function StartView(props: {
  assetId: string;
  pageNumber: number;
  subjectId: string;
  topicId: string;
  gripProps: DragGripProps;
  onStarted: () => void;
}) {
  const { problemIdx, subproblemLabel, setProblemIdx, setSubproblemLabel, startAttempt } =
    useStudyStore();

  const subLabel = normalizeLabel(subproblemLabel);
  const canDecProblem = problemIdx > 1;
  const canIncProblem = problemIdx < 999;

  const canDecSub = subLabel !== 'a';
  const canIncSub = subLabel !== 'z';

  return (
    <>
      <PanelViewHeader
        left={
          <PanelHeading>
            <MutedText>Diese Aufgabe </MutedText>
            <HighlightText>Starten?</HighlightText>
          </PanelHeading>
        }
        right={
          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-full bg-white/5 text-white/70 hover:bg-white/10 hover:text-white/90"
            aria-label="Info"
            title="Info"
            onClick={() => {}}
          >
            <Info className="size-4" />
          </button>
        }
      />

      <div className="mt-3">
        <Row
          label="Aufgabe"
          right={
            <Stepper
              value={String(problemIdx)}
              decDisabled={!canDecProblem}
              incDisabled={!canIncProblem}
              onDec={() => setProblemIdx(Math.max(1, problemIdx - 1))}
              onInc={() => setProblemIdx(Math.min(999, problemIdx + 1))}
            />
          }
        />

        <Row
          label="Teilaufgabe"
          right={
            <Stepper
              value={subLabel}
              decDisabled={!canDecSub}
              incDisabled={!canIncSub}
              onDec={() => setSubproblemLabel(prevLabel(subLabel))}
              onInc={() => setSubproblemLabel(nextLabel(subLabel))}
            />
          }
        />
      </div>

      <div className="mt-8 flex items-center justify-end gap-2">
        <PrimaryButton
          onClick={() => {
            startAttempt({ assetId: props.assetId });
            props.onStarted();
          }}
        >
          Starten
        </PrimaryButton>
      </div>
    </>
  );
}

function Row(props: { label: string; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <MutedText className="text-sm font.medium">{props.label}</MutedText>
      {props.right}
    </div>
  );
}

function Stepper(props: {
  value: string;
  decDisabled: boolean;
  incDisabled: boolean;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div className="inline-flex justify-between items-center gap-1 rounded-full p-1">
      <div className="text-sm font-semibold text-white tabular-nums pr-2">{props.value}</div>
      <div className="flex gap-2 scale-90">
        <SecondaryButton
          disabled={props.decDisabled}
          onClick={props.onDec}
          icon={<Minus className="size-4" />}
        />
        <SecondaryButton
          disabled={props.incDisabled}
          onClick={props.onInc}
          icon={<Plus className="size-4" />}
        />
      </div>
    </div>
  );
}

function normalizeLabel(label: string) {
  const l = label.trim().toLowerCase();
  if (l.length !== 1) return l || 'a';
  const c = l.charCodeAt(0);
  if (c < 97 || c > 122) return l;
  return l;
}

function nextLabel(label: string) {
  const l = normalizeLabel(label);
  const c = l.charCodeAt(0);
  if (c < 97 || c > 122) return l;
  if (c === 122) return 'z';
  return String.fromCharCode(c + 1);
}

function prevLabel(label: string) {
  const l = normalizeLabel(label);
  const c = l.charCodeAt(0);
  if (c < 97 || c > 122) return l;
  if (c === 97) return 'a';
  return String.fromCharCode(c - 1);
}
