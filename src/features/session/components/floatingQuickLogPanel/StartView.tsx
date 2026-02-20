import { Minus, Plus } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { IoSettingsOutline } from 'react-icons/io5';
import { GhostButton, PrimaryButton } from '../../../../components/Button';
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
  onOpenConfig: () => void;
}) {
  const {
    problemIdx,
    subproblemLabel,
    subsubproblemLabel,
    setProblemIdx,
    setSubproblemLabel,
    setSubsubproblemLabel,
    startAttempt,
    loadTaskDepth,
    taskDepthByAssetId,
  } = useStudyStore();

  useEffect(() => {
    void loadTaskDepth(props.assetId);
  }, [props.assetId, loadTaskDepth]);

  const depth = taskDepthByAssetId[props.assetId] ?? 2;
  const showSub = depth >= 2;
  const showSubSub = depth >= 3;

  const rows = useMemo(() => {
    const out: Array<{ key: string; label: string; right: React.ReactNode }> = [
      {
        key: 'problem',
        label: 'Aufgabe',
        right: (
          <Stepper
            key={`problem:${problemIdx}`}
            value={String(problemIdx)}
            kind="number"
            min={1}
            max={999}
            onChange={(next) => setProblemIdx(Number.parseInt(next, 10))}
          />
        ),
      },
    ];
    if (showSub) {
      out.push({
        key: 'subproblem',
        label: 'Teilaufgabe',
        right: (
          <Stepper
            key={`subproblem:${subproblemLabel}`}
            value={subproblemLabel}
            kind="free"
            emptyValue="a"
            minFreeNumber={1}
            onChange={(next) => setSubproblemLabel(next)}
          />
        ),
      });
    }
    if (showSubSub) {
      out.push({
        key: 'subsubproblem',
        label: 'Unteraufgabe',
        right: (
          <Stepper
            key={`subsubproblem:${subsubproblemLabel}`}
            value={subsubproblemLabel}
            kind="free"
            emptyValue="1"
            minFreeNumber={1}
            onChange={(next) => setSubsubproblemLabel(next)}
          />
        ),
      });
    }
    return out;
  }, [
    problemIdx,
    setProblemIdx,
    showSub,
    showSubSub,
    subproblemLabel,
    setSubproblemLabel,
    subsubproblemLabel,
    setSubsubproblemLabel,
  ]);

  return (
    <div className="flex flex-col h-full">
      <div>
        <PanelViewHeader
          left={
            <PanelHeading>
              <MutedText>Diese Aufgabe </MutedText>
              <HighlightText>Starten?</HighlightText>
            </PanelHeading>
          }
          // right={
          //   <>
          //     <GhostButton
          //       onClick={() => {}}
          //       icon={<IoInformationCircleOutline className="text-2xl" />}
          //     />
          //   </>
          // }
        />

        <div className="mt-3 space-y-1">
          {rows.map((r) => (
            <Row key={r.key} label={r.label} right={r.right} />
          ))}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2">
        <GhostButton onClick={props.onOpenConfig} icon={<IoSettingsOutline />} />
        <PrimaryButton
          onClick={() => {
            startAttempt({ assetId: props.assetId });
            props.onStarted();
          }}
        >
          Starten
        </PrimaryButton>
      </div>
    </div>
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
  minFreeNumber?: number;
  onChange: (next: string) => void;
}) {
  const [draft, setDraft] = useState(props.value);
  const displayValue = draft;

  const parseFreeAsInt = (raw: string) => {
    const t = raw.trim();
    if (!t) return null;
    if (!/^\d+$/.test(t)) return null;
    const n = Number.parseInt(t, 10);
    return Number.isFinite(n) ? n : null;
  };

  const clampFreeNumber = (n: number) => {
    const min = props.minFreeNumber ?? Number.NEGATIVE_INFINITY;
    return Math.max(min, n);
  };

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
    const maybeFreeN = props.minFreeNumber != null ? parseFreeAsInt(trimmed) : null;
    const normalized =
      maybeFreeN != null ? String(clampFreeNumber(maybeFreeN)) : trimmed || props.emptyValue || '';
    setDraft(normalized);
    props.onChange(normalized);
  };

  const freeN =
    props.kind === 'free' && props.minFreeNumber != null ? parseFreeAsInt(displayValue) : null;

  const decDisabled =
    props.kind === 'number'
      ? parseCurrentNumber() <= (props.min ?? Number.NEGATIVE_INFINITY)
      : freeN != null
      ? clampFreeNumber(freeN) <= (props.minFreeNumber ?? Number.NEGATIVE_INFINITY)
      : !canDecrementSuffix((displayValue.trim() || props.emptyValue || '').trim());

  const incDisabled =
    props.kind === 'number'
      ? parseCurrentNumber() >= (props.max ?? Number.POSITIVE_INFINITY)
      : freeN != null
      ? false
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
      <div className="flex gap-2 scale-80 relative -right-2">
        <GhostButton
          disabled={decDisabled}
          onClick={() => {
            if (props.kind === 'number') {
              const next = clampNumber(parseCurrentNumber() - 1);
              const normalized = String(next);
              setDraft(normalized);
              props.onChange(normalized);
              return;
            }
            if (freeN != null) {
              const next = clampFreeNumber(freeN - 1);
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
        <GhostButton
          disabled={incDisabled}
          onClick={() => {
            if (props.kind === 'number') {
              const next = clampNumber(parseCurrentNumber() + 1);
              const normalized = String(next);
              setDraft(normalized);
              props.onChange(normalized);
              return;
            }
            if (freeN != null) {
              const next = clampFreeNumber(freeN + 1);
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
