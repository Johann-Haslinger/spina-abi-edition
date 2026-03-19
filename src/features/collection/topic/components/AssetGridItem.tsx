import type { Asset, AssetFile, ExercisePageStatus } from '../../../../domain/models';
import { formatExerciseStatus } from '../../../session/viewer/viewerUtils';
import { assetTypeLabel } from '../utils/assetTypeLabel';
import { AssetThumbnail } from './AssetThumbnail';

export function AssetGridItem(props: {
  asset: Asset;
  folderLabel: string;
  exerciseStatus?: ExercisePageStatus;
  loadFile: (assetId: string) => Promise<AssetFile | undefined>;
  onOpen: () => void;
  onDownload: () => void;
  onDelete: () => void;
}) {
  const { asset } = props;

  return (
    <li className="w-full group ">
      <button
        type="button"
        onClick={props.onOpen}
        className="flex w-full flex-col cursor-pointer items-center justify-center"
      >
        <AssetThumbnail
          assetId={asset.id}
          assetType={asset.type}
          title={asset.title}
          loadFile={props.loadFile}
        />

        <div className="mt-3 w-full text-center">
          <div className="line-clamp-3 text-sm font-medium leading-5 text-black dark:text-white">
            {asset.title}
          </div>
          <div className="text-xs mt-1 text-white/60">
            {assetTypeLabel(asset.type)}
            {asset.type === 'exercise' && (
              <span> · {formatExerciseStatus(props.exerciseStatus ?? 'unknown')}</span>
            )}
          </div>
        </div>
      </button>

      {/* <div className="flex items-center justify-end gap-1 border-t border-white/5 px-2 py-2">
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
      </div> */}
    </li>
  );
}
