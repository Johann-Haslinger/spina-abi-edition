import { IoAdd } from 'react-icons/io5';
import type { Asset, AssetFile, AssetType, ExercisePageStatus } from '../../../../domain/models';
import { GhostButton } from '../../../../components/Button';
import { AssetGridItem } from './AssetGridItem';
import { FilterChip } from './FilterChip';

export function TopicAssetsView(props: {
  assetsError?: string;
  assetFilter: 'all' | AssetType;
  onFilterChange: (value: 'all' | AssetType) => void;
  onUpload: () => void;
  assetsLoading: boolean;
  assets: Asset[];
  folderNameById: Map<string, string>;
  exerciseStatusByAssetId: Record<string, ExercisePageStatus>;
  loadFile: (assetId: string) => Promise<AssetFile | undefined>;
  onOpen: (asset: Asset) => void | Promise<void>;
  onDownload: (asset: Asset) => void | Promise<void>;
  onDelete: (asset: Asset) => void | Promise<void>;
}) {
  return (
    <>
      {props.assetsError ? (
        <div className="mt-3 rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
          {props.assetsError}
        </div>
      ) : null}

      <div className="flex justify-between items-center">
        <div className="flex flex-wrap items-center gap-2">
          <FilterChip
            active={props.assetFilter === 'all'}
            onClick={() => props.onFilterChange('all')}
            label="Alle"
          />
          <FilterChip
            active={props.assetFilter === 'exercise'}
            onClick={() => props.onFilterChange('exercise')}
            label="Übungen"
          />
          <FilterChip
            active={props.assetFilter === 'cheatsheet'}
            onClick={() => props.onFilterChange('cheatsheet')}
            label="Merkblätter"
          />
          <FilterChip
            active={props.assetFilter === 'note'}
            onClick={() => props.onFilterChange('note')}
            label="Notizen"
          />
          <FilterChip
            active={props.assetFilter === 'file'}
            onClick={() => props.onFilterChange('file')}
            label="Dateien"
          />
        </div>
        <GhostButton onClick={props.onUpload} icon={<IoAdd />} className="text-sm">
          Upload
        </GhostButton>
      </div>

      {props.assetsLoading ? (
        <div className="mt-3 text-sm text-slate-400">Lade…</div>
      ) : props.assets.length === 0 ? (
        <div className="mt-3 text-sm text-slate-400">Keine Assets in dieser Ansicht.</div>
      ) : (
        <ul className="mt-12 grid grid-cols-4 gap-3 lg:grid-cols-7 xl:grid-cols-7">
          {props.assets.map((asset) => (
            <AssetGridItem
              key={asset.id}
              asset={asset}
              folderLabel={asset.folderId ? props.folderNameById.get(asset.folderId) ?? '—' : 'Ohne Ordner'}
              exerciseStatus={
                asset.type === 'exercise' ? props.exerciseStatusByAssetId[asset.id] : undefined
              }
              loadFile={props.loadFile}
              onOpen={() => void props.onOpen(asset)}
              onDownload={() => void props.onDownload(asset)}
              onDelete={() => void props.onDelete(asset)}
            />
          ))}
        </ul>
      )}
    </>
  );
}
