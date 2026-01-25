import { Download, ExternalLink, Trash2 } from 'lucide-react'
import type { Asset } from '../../../../domain/models'
import { assetTypeLabel } from '../utils/assetTypeLabel'

export function AssetItem(props: {
  asset: Asset
  folderLabel: string
  onOpen: () => void
  onDownload: () => void
  onDelete: () => void
}) {
  const { asset: a } = props

  return (
    <li className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2">
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-50">
          {a.title}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="rounded bg-slate-900 px-2 py-0.5">
            {assetTypeLabel(a.type)}
          </span>
          <span className="rounded bg-slate-900 px-2 py-0.5">
            Folder: {props.folderLabel}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={props.onOpen}
          className="rounded-md p-2 text-slate-300 hover:bg-slate-900 hover:text-slate-50"
          aria-label="Öffnen"
          title="Öffnen"
        >
          <ExternalLink className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={props.onDownload}
          className="rounded-md p-2 text-slate-300 hover:bg-slate-900 hover:text-slate-50"
          aria-label="Download"
          title="Download"
        >
          <Download className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={props.onDelete}
          className="rounded-md p-2 text-rose-200 hover:bg-rose-950/50"
          aria-label="Löschen"
          title="Löschen"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </li>
  )
}

