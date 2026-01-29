import { useParams } from 'react-router-dom';
import { NotFoundPage } from '../../../common/NotFoundPage';
import { ExerciseAssetView } from '../views/ExerciseAssetView';

export function AssetPage() {
  const { assetId } = useParams();
  if (!assetId) return <NotFoundPage />;
  return <ExerciseAssetView assetId={assetId} />;
}
