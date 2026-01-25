import type { Folder } from '../../../../domain/models'

export function flattenFoldersForSelect(folders: Folder[]) {
  const rootKey = '__root__'
  const childrenByParent = new Map<string, Folder[]>()

  for (const f of folders) {
    const key = f.parentFolderId ?? rootKey
    const arr = childrenByParent.get(key) ?? []
    arr.push(f)
    childrenByParent.set(key, arr)
  }

  const out: Array<{ id: string; label: string }> = []
  const walk = (parentId: string, depth: number) => {
    for (const f of childrenByParent.get(parentId) ?? []) {
      const label = `${'—'.repeat(depth)} ${f.iconEmoji ? f.iconEmoji + ' ' : ''}${f.name}`.trim()
      out.push({ id: f.id, label })
      walk(f.id, depth + 1)
    }
  }
  walk(rootKey, 0)
  return out
}

