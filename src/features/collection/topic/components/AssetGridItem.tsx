import { Download, ExternalLink, Trash2 } from 'lucide-react';
import { CollectionItemActionWrapper } from '../../../../components/CollectionItemActionWrapper';
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
    <li className="w-full group list-none pb-6">
      <CollectionItemActionWrapper
        className="w-full"
        contentClassName="flex w-full flex-col items-center justify-center"
        primaryAction={props.onOpen}
        actions={[
          {
            key: 'open',
            label: 'Öffnen',
            icon: <ExternalLink className="h-4 w-4" />,
            onSelect: props.onOpen,
          },
          {
            key: 'download',
            label: 'Download',
            icon: <Download className="h-4 w-4" />,
            onSelect: props.onDownload,
          },
          {
            key: 'delete',
            label: 'Löschen',
            icon: <Trash2 className="h-4 w-4" />,
            tone: 'danger',
            onSelect: props.onDelete,
          },
        ]}
      >
        <AssetThumbnail
          assetId={asset.id}
          assetType={asset.type}
          title={asset.title}
          loadFile={props.loadFile}
        />

        <div className="mt-3 w-full text-center">
          <div className="line-clamp-2 text-sm font-medium leading-5 text-black dark:text-white">
            {asset.title}
          </div>
          <div className="text-xs mt-1 text-white/60">
            {assetTypeLabel(asset.type)}
            {asset.type === 'exercise' && (
              <span> · {formatExerciseStatus(props.exerciseStatus ?? 'unknown')}</span>
            )}
          </div>
        </div>
      </CollectionItemActionWrapper>
    </li>
  );
}
