import type { AssetType } from '../../../../domain/models'

export function assetTypeLabel(t: AssetType) {
  switch (t) {
    case 'exercise':
      return 'Übung'
    case 'cheatsheet':
      return 'Merkblatt'
    case 'note':
      return 'Notiz'
    case 'file':
      return 'Datei'
  }
}

