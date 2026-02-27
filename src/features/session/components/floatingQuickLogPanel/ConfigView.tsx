import { useEffect, useMemo, useState } from 'react';
import { IoAddCircle, IoRemoveCircle } from 'react-icons/io5';
import { PrimaryButton } from '../../../../components/Button';
import { useStudyStore } from '../../stores/studyStore';
import { PanelViewHeader, type DragGripProps } from './PanelViewHeader';
import { HighlightText, MutedText, PanelHeading } from './TextHighlight';

export function ConfigView(props: {
  gripProps: DragGripProps;
  assetId: string;
  onClose: () => void;
}) {
  const { taskDepthByAssetId, loadTaskDepth, setTaskDepth, decreaseTaskDepthWithCleanup } =
    useStudyStore();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadTaskDepth(props.assetId);
  }, [props.assetId, loadTaskDepth]);

  const depth = taskDepthByAssetId[props.assetId] ?? 2;

  const rows = useMemo(() => {
    const out: Array<{
      key: 'p' | 'sp' | 'ssp';
      label: string;
      removable: boolean;
      nextDepth: 1 | 2 | 3;
    }> = [{ key: 'p', label: 'Aufgabe', removable: false, nextDepth: 1 }];
    if (depth >= 2) out.push({ key: 'sp', label: 'Teilaufgabe', removable: true, nextDepth: 1 });
    if (depth >= 3) out.push({ key: 'ssp', label: 'Unteraufgabe', removable: true, nextDepth: 2 });
    return out;
  }, [depth]);

  const canAdd = depth < 3 && !saving;

  const applyIncrease = async () => {
    const next = Math.min(3, depth + 1) as 1 | 2 | 3;
    setSaving(true);
    try {
      await setTaskDepth(props.assetId, next);
    } finally {
      setSaving(false);
    }
  };

  const applyDecrease = async (next: 1 | 2 | 3) => {
    setSaving(true);
    try {
      await decreaseTaskDepthWithCleanup(props.assetId, next);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div>
        <PanelViewHeader
          left={
            <PanelHeading>
              <MutedText>Unterteilung </MutedText>
              <HighlightText>Konfiguration</HighlightText>
            </PanelHeading>
          }
        />

        <div className="mt-4 space-y-3">
          <div className="mt-2 space-y-1 text-white">
            {rows.map((r) => (
              <div key={r.key} className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <button
                    onClick={() => void applyDecrease(r.nextDepth)}
                    className={` transition-all ${
                      r.removable
                        ? 'text-white/90 cursor-pointer hover:text-white active:text-lg'
                        : 'cursor-not-allowed text-white/20'
                    }`}
                  >
                    <IoRemoveCircle className="text-xl" />
                  </button>
                  <span className="truncate text-white">{r.label}</span>
                </div>
              </div>
            ))}

            {depth < 3 ? (
              <button
                type="button"
                disabled={!canAdd}
                onClick={() => void applyIncrease()}
                className="flex cursor-pointer mt-4 items-center gap-2 min-w-0"
              >
                <IoAddCircle className="text-xl text-white/90 hover:text-white active:text-lg" />
                <span>Unterteilung</span>
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-end gap-2">
        <PrimaryButton onClick={props.onClose} disabled={saving}>
          Fertig
        </PrimaryButton>
      </div>
    </div>
  );
}
