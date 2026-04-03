import { motion } from 'framer-motion';
import { ChevronDown, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { IoCheckmark, IoPencil, IoShareOutline } from 'react-icons/io5';
import { ActionDialog } from '../../../components/ActionDialog';
import type { AssetFile, AssetType, InkStroke } from '../../../domain/models';
import { useNotificationsStore } from '../../../stores/notificationsStore';
import { AssetThumbnail } from '../../collection/topic/components/AssetThumbnail';
import { ExerciseAssetExportModal } from './ExerciseAssetExportModal';

export function ExerciseAssetHeaderMorph(props: {
  title: string;
  subtitle: string;
  fileLabel: string;
  assetId: string;
  assetType: AssetType;
  loadFile: (assetId: string) => Promise<AssetFile | undefined>;
  getExportStrokes: () => Promise<InkStroke[]>;
  onRename: (nextTitle: string) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  renameBusy?: boolean;
  deleteBusy?: boolean;
}) {
  const { loadFile, assetId } = props;
  const [expanded, setExpanded] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [shareFileCached, setShareFileCached] = useState<AssetFile | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const renameFieldId = useId();
  const pushNotification = useNotificationsStore((s) => s.push);

  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (e: PointerEvent) => {
      if (exportOpen || deleteOpen) return;
      const el = rootRef.current;
      if (!el || el.contains(e.target as Node)) return;
      setExpanded(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [expanded, exportOpen, deleteOpen]);

  useEffect(() => {
    if (!renameOpen) return;
    const id = window.requestAnimationFrame(() => {
      const el = renameInputRef.current;
      if (!el) return;
      el.focus();
      el.select();
    });
    return () => window.cancelAnimationFrame(id);
  }, [renameOpen]);

  useEffect(() => {
    let cancelled = false;
    setShareFileCached(null);
    void loadFile(assetId).then((f) => {
      if (!cancelled && f) setShareFileCached(f);
    });
    return () => {
      cancelled = true;
    };
  }, [assetId, loadFile]);

  const cancelRename = useCallback(() => {
    setDraft(props.title);
    setRenameOpen(false);
  }, [props.title]);

  const commitRename = async () => {
    const next = draft.trim();
    if (!next || next === props.title) {
      cancelRename();
      return;
    }
    await props.onRename(next);
    setRenameOpen(false);
  };

  const onShareFile = () => {
    const f = shareFileCached;
    if (!f) {
      pushNotification({
        tone: 'info',
        title: 'Teilen',
        message: 'Datei wird noch geladen…',
      });
      return;
    }
    const file = new File([f.blob], f.originalName, {
      type: f.mimeType || 'application/octet-stream',
      lastModified: Date.now(),
    });
    if (typeof navigator.share !== 'function') {
      pushNotification({
        tone: 'info',
        title: 'Teilen',
        message: 'Teilen wird hier nicht unterstützt.',
      });
      return;
    }
    navigator
      .share({ files: [file], title: props.title })
      .then(() => setExpanded(false))
      .catch((first: Error) => {
        if (first.name === 'AbortError') throw first;
        return navigator.share({ files: [file] }).then(() => setExpanded(false));
      })
      .catch((e: Error) => {
        if (e.name === 'AbortError') return;
        pushNotification({
          tone: 'error',
          title: 'Teilen',
          message: e.message || 'Teilen fehlgeschlagen',
        });
      });
  };

  const shellClass = renameOpen
    ? 'w-[min(100vw-4.5rem,40rem)] max-w-none'
    : expanded
      ? 'w-54 max-w-[min(100vw-4rem,19rem)] ml-2 border border-white/5 bg-(--app-floating-bg)'
      : 'w-80 max-w-[min(100vw-6rem,19rem)]';

  return (
    <>
      <motion.div
        layout
        ref={rootRef}
        aria-expanded={expanded}
        animate={{
          y: expanded ? 4 : 0,
          borderRadius: expanded ? 22 : renameOpen ? 16 : 0,
        }}
        className={`pointer-events-auto rounded-2xl overflow-hidden border-white/5 text-left text-white ${shellClass}`}
      >
        {renameOpen ? (
          <div className="flex w-full min-w-0 items-center gap-2 bg-white/5 border-white/5 border py-2 pl-3 pr-2 rounded-full text-sm">
            <input
              ref={renameInputRef}
              id={renameFieldId}
              value={draft}
              disabled={props.renameBusy}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => {
                if (props.renameBusy) return;
                cancelRename();
              }}
              className="min-w-0 flex-1 rounded-lg pt-0.5 text-sm  text-white outline-none"
              placeholder="Titel"
            />
            <button
              type="button"
              disabled={props.renameBusy || !draft.trim()}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void commitRename()}
              className="shrink-0 p-1 text-xl font-semibold rounded-full bg-white/90 hover:bg-white text-black disabled:opacity-40"
            >
              <IoCheckmark />
            </button>
          </div>
        ) : expanded ? (
          <motion.div
            layout
            className="flex flex-col pb-5 px-3 pt-4 text-left"
            initial={{ opacity: 0.85 }}
            animate={{ opacity: 1 }}
          >
            <div className="flex w-full items-center gap-2">
              <AssetThumbnail
                className="h-11! w-8!"
                assetId={assetId}
                assetType={props.assetType}
                title={props.title}
                loadFile={props.loadFile}
              />
              <div className="min-w-0 flex-1">
                <div className="text-xs w-28 truncate font-medium leading-tight">{props.title}</div>

                {props.fileLabel ? (
                  <div className="mt-0.5 text-[11px] text-white/45">{props.fileLabel}</div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => void onShareFile()}
                className="shrink-0 rounded-full -mt-1 bg-white/10 p-1.5 text-white hover:bg-white/15"
                aria-label="Datei teilen"
                title="Teilen"
              >
                <IoShareOutline className="size-4" />
              </button>
            </div>
            <div className="px-2 w-full">
              <button
                type="button"
                className="mt-3 flex items-center gap-3 py-2.5 text-left text-sm text-white/95 hover:text-white"
                onClick={() => {
                  setExpanded(false);
                  setDraft(props.title);
                  setRenameOpen(true);
                }}
              >
                <IoPencil className="size-4 shrink-0" />
                Umbenennen
              </button>
              <button
                type="button"
                className="flex items-center gap-3 pt-2.5 pb-5 text-left text-sm text-white/95 hover:text-white"
                onClick={() => {
                  setExpanded(false);
                  setExportOpen(true);
                }}
              >
                <IoShareOutline className="size-4 shrink-0" />
                Exportieren
              </button>
              <button
                type="button"
                disabled={props.deleteBusy}
                onClick={() => {
                  setExpanded(false);
                  setDeleteOpen(true);
                }}
                className="flex w-full items-center gap-3 border-t border-white/10 pt-4 text-left text-sm text-white/95 hover:text-white disabled:opacity-50"
              >
                <Trash2 className="size-4 shrink-0" />
                Löschen
              </button>
            </div>
          </motion.div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(props.title);
              setExpanded(true);
            }}
            className="flex w-full min-w-0 items-start gap-2 pt-4 pl-3 text-left transition hover:bg-white/5"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold leading-tight">{props.title}</div>
            </div>
            <ChevronDown className="mt-0.5 size-4 shrink-0 text-white/70" aria-hidden />
          </button>
        )}
      </motion.div>

      <ExerciseAssetExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        getExportStrokes={props.getExportStrokes}
        titleForFilename={props.title}
      />

      <ActionDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        busy={props.deleteBusy}
        title="Übung löschen?"
        message={`„${props.title}“ wirklich löschen? Dies kann nicht rückgängig gemacht werden.`}
        actions={[
          {
            key: 'cancel',
            label: 'Abbrechen',
            tone: 'neutral',
            onClick: () => setDeleteOpen(false),
          },
          {
            key: 'delete',
            label: 'Löschen',
            tone: 'danger',
            onClick: () =>
              void (async () => {
                try {
                  await props.onDelete();
                } finally {
                  setDeleteOpen(false);
                }
              })(),
          },
        ]}
      />
    </>
  );
}
