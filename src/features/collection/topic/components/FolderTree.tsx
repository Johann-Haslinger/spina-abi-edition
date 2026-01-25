import { Pencil, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import type { Folder } from '../../../../domain/models'

export function FolderTree(props: {
  folders: Folder[]
  onRename: (folder: Folder) => void
  onDelete: (folder: Folder) => void
}) {
  const { folders, onRename, onDelete } = props

  const childrenByParent = useMemo(() => {
    const map = new Map<string, Folder[]>()
    const rootKey = '__root__'
    for (const f of folders) {
      const key = f.parentFolderId ?? rootKey
      const arr = map.get(key) ?? []
      arr.push(f)
      map.set(key, arr)
    }
    return { map, rootKey }
  }, [folders])

  const renderNode = (parentId: string, depth: number) => {
    const children = childrenByParent.map.get(parentId) ?? []
    if (children.length === 0) return null

    return (
      <ul className={depth === 0 ? 'mt-3 space-y-1' : 'mt-1 space-y-1'}>
        {children.map((f) => (
          <li key={f.id}>
            <div
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1 hover:bg-slate-900"
              style={{ paddingLeft: 8 + depth * 14 }}
            >
              <div className="min-w-0 truncate text-sm text-slate-200">
                {f.iconEmoji ? `${f.iconEmoji} ` : ''}
                {f.name}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onRename(f)}
                  className="rounded-md p-1.5 text-slate-300 hover:bg-slate-950 hover:text-slate-50"
                  aria-label="Umbenennen"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(f)}
                  className="rounded-md p-1.5 text-rose-200 hover:bg-rose-950/50"
                  aria-label="Löschen"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {renderNode(f.id, depth + 1)}
          </li>
        ))}
      </ul>
    )
  }

  return renderNode(childrenByParent.rootKey, 0)
}

