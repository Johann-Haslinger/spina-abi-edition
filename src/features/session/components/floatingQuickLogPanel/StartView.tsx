import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { IoInformationCircleOutline } from 'react-icons/io5';
import { GhostButton, PrimaryButton, SecondaryButton } from '../../../../components/Button';
import { useStudyStore } from '../../stores/studyStore';
import { PanelViewHeader, type DragGripProps } from './PanelViewHeader';
import { HighlightText, MutedText, PanelHeading } from './TextHighlight';
import {
  canDecrementSuffix,
  canIncrementSuffix,
  decrementSuffix,
  incrementSuffix,
} from './stepperSuffix';

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
          <GhostButton
            onClick={() => {}}
            icon={<IoInformationCircleOutline className="text-2xl" />}
          />
        }
      />

      <div className="mt-3">
        <Row
          label="Aufgabe"
          right={
            <Stepper
              key={`problem:${problemIdx}`}
              value={String(problemIdx)}
              kind="number"
              min={1}
              max={999}
              onChange={(next) => setProblemIdx(Number.parseInt(next, 10))}
            />
          }
        />

        <Row
          label="Teilaufgabe"
          right={
            <Stepper
              key={`subproblem:${subproblemLabel}`}
              value={subproblemLabel}
              kind="free"
              emptyValue="a"
              onChange={(next) => setSubproblemLabel(next)}
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
    <div className="flex items-center justify-between">
      <MutedText className="text-sm w-20! font-medium">{props.label}</MutedText>
      {props.right}
    </div>
  );
}

function Stepper(props: {
  value: string;
  kind: 'number' | 'free';
  min?: number;
  max?: number;
  emptyValue?: string;
  onChange: (next: string) => void;
}) {
  const [draft, setDraft] = useState(props.value);
  const displayValue = draft;

  const parseCurrentNumber = () => {
    const digits = displayValue.replace(/[^\d]/g, '');
    const fallbackDigits = props.value.replace(/[^\d]/g, '');
    const n = Number.parseInt(digits || fallbackDigits || '0', 10);
    return Number.isFinite(n) ? n : 0;
  };

  const clampNumber = (n: number) => {
    const min = props.min ?? Number.NEGATIVE_INFINITY;
    const max = props.max ?? Number.POSITIVE_INFINITY;
    return Math.max(min, Math.min(max, n));
  };

  const commit = () => {
    if (props.kind === 'number') {
      const digits = displayValue.replace(/[^\d]/g, '');
      const n = Number.parseInt(digits || String(props.min ?? 0), 10);
      const normalized = String(clampNumber(Number.isFinite(n) ? n : props.min ?? 0));
      setDraft(normalized);
      props.onChange(normalized);
      return;
    }

    const trimmed = displayValue.trim();
    const normalized = trimmed || props.emptyValue || '';
    setDraft(normalized);
    props.onChange(normalized);
  };

  const decDisabled =
    props.kind === 'number'
      ? parseCurrentNumber() <= (props.min ?? Number.NEGATIVE_INFINITY)
      : !canDecrementSuffix((displayValue.trim() || props.emptyValue || '').trim());

  const incDisabled =
    props.kind === 'number'
      ? parseCurrentNumber() >= (props.max ?? Number.POSITIVE_INFINITY)
      : !canIncrementSuffix((displayValue.trim() || props.emptyValue || '').trim());

  return (
    <div className="inline-flex justify-end items-center rounded-full">
      <input
        value={displayValue}
        onChange={(e) => {
          const nextRaw = e.target.value;
          const next = props.kind === 'number' ? nextRaw.replace(/[^\d]/g, '') : nextRaw;
          setDraft(next);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur();
        }}
        inputMode={props.kind === 'number' ? 'numeric' : undefined}
        className="w-10 bg-transparent outline-none text-sm font-semibold text-white tabular-nums pr-2 text-right"
      />
      <div className="flex gap-2 scale-80">
        <SecondaryButton
          disabled={decDisabled}
          onClick={() => {
            if (props.kind === 'number') {
              const next = clampNumber(parseCurrentNumber() - 1);
              const normalized = String(next);
              setDraft(normalized);
              props.onChange(normalized);
              return;
            }
            const current = displayValue.trim() || props.emptyValue || '';
            const next = decrementSuffix(current);
            const normalized = (next || props.emptyValue || '').trim() || props.emptyValue || '';
            setDraft(normalized);
            props.onChange(normalized);
          }}
          icon={<Minus className="size-4" />}
        />
        <SecondaryButton
          disabled={incDisabled}
          onClick={() => {
            if (props.kind === 'number') {
              const next = clampNumber(parseCurrentNumber() + 1);
              const normalized = String(next);
              setDraft(normalized);
              props.onChange(normalized);
              return;
            }
            const current = displayValue.trim() || props.emptyValue || '';
            const next = incrementSuffix(current);
            const normalized = (next || props.emptyValue || '').trim() || props.emptyValue || '';
            setDraft(normalized);
            props.onChange(normalized);
          }}
          icon={<Plus className="size-4" />}
        />
      </div>
    </div>
  );
}
