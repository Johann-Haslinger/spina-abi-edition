import { useEffect, useState } from 'react';
import { Modal } from '../../../components/Modal';
import type { InkStroke } from '../../../domain/models';
import { renderInkOnlyRasterBlob } from '../../../ink/export';
import { embedRasterBytesInPdf } from '../../../ink/pdfRasterExport';
import { safeDownloadBasename } from '../../../lib/assetFileLabel';

type ExportFormat = 'png' | 'jpeg' | 'pdf';

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function triggerDownloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
  triggerDownload(blob, filename);
}

export function ExerciseAssetExportModal(props: {
  open: boolean;
  onClose: () => void;
  getExportStrokes: () => Promise<InkStroke[]>;
  titleForFilename: string;
}) {
  const [format, setFormat] = useState<ExportFormat>('png');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [strokeCount, setStrokeCount] = useState<number | null>(null);

  const base = safeDownloadBasename(props.titleForFilename);

  useEffect(() => {
    if (!props.open) return;
    setError(null);
    setBusy(false);
    setFormat('png');
    let cancelled = false;
    void (async () => {
      try {
        const s = await props.getExportStrokes();
        if (!cancelled) setStrokeCount(s.length);
      } catch {
        if (!cancelled) setStrokeCount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.open, props.getExportStrokes]);

  const runExport = async () => {
    setBusy(true);
    setError(null);
    try {
      const strokes = await props.getExportStrokes();
      if (strokes.length === 0) {
        setError('Kein Ink zum Exportieren.');
        return;
      }

      if (format === 'pdf') {
        const pngBlob = await renderInkOnlyRasterBlob(strokes, 'image/png');
        const bytes = new Uint8Array(await pngBlob.arrayBuffer());
        const pdfOut = await embedRasterBytesInPdf(bytes, 'png');
        triggerDownloadBytes(pdfOut, `${base}.pdf`);
      } else if (format === 'jpeg') {
        const imageBlob = await renderInkOnlyRasterBlob(strokes, 'image/jpeg');
        triggerDownload(imageBlob, `${base}.jpg`);
      } else {
        const imageBlob = await renderInkOnlyRasterBlob(strokes, 'image/png');
        triggerDownload(imageBlob, `${base}.png`);
      }

      props.onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  };

  const exportDisabled = busy || (strokeCount !== null && strokeCount === 0);

  return (
    <Modal
      open={props.open}
      onClose={busy ? () => {} : props.onClose}
      footer={
        <>
          <button
            type="button"
            disabled={busy}
            onClick={props.onClose}
            className="rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-50"
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={exportDisabled}
            onClick={() => void runExport()}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-50"
          >
            {busy ? 'Exportiert…' : 'Exportieren'}
          </button>
        </>
      }
    >
      <div className="text-base font-semibold text-white">Ink exportieren</div>
      <p className="mt-2 text-sm text-white/60">
        Es wird nur dein Ink exportiert (PNG, JPEG oder als einseitige PDF-Datei mit dem
        Ink-Raster).
      </p>

      <div className="mt-5 space-y-3">
        <div className="text-xs font-medium text-white/55">Inhalt</div>
        <div className="flex flex-col gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-white/90">
            <input type="radio" name="export-content" checked readOnly className="accent-white" />
            Nur Ink
          </label>
          <div
            className="flex flex-col gap-0.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-white/35"
            aria-disabled
          >
            <div className="flex items-center gap-2 text-sm">
              <input type="radio" disabled className="accent-white opacity-40" readOnly />
              <span>PDF + Ink</span>
            </div>
            <div className="pl-6 text-xs text-white/30">Bald verfügbar</div>
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <div className="text-xs font-medium text-white/55">Format</div>
        <div className="flex flex-wrap gap-3">
          {(['png', 'jpeg', 'pdf'] as const).map((f) => (
            <label key={f} className="flex cursor-pointer items-center gap-2 text-sm text-white/90">
              <input
                type="radio"
                name="export-format"
                checked={format === f}
                onChange={() => setFormat(f)}
                className="accent-white"
              />
              {f === 'png' ? 'PNG' : f === 'jpeg' ? 'JPEG' : 'PDF'}
            </label>
          ))}
        </div>
      </div>

      {strokeCount === 0 ? (
        <div className="mt-4 text-sm text-amber-200/90">Kein Ink zum Exportieren.</div>
      ) : null}
      {error ? <div className="mt-4 text-sm text-rose-200">{error}</div> : null}
    </Modal>
  );
}
