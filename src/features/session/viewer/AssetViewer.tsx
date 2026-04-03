import { useEffect, useMemo } from 'react';
import type { AssetFile } from '../../../domain/models';
import type { InkHydrateInput } from '../../../ink/persist';
import { ErrorPage } from '../../common/ErrorPage';
import { ImagePanZoomViewer } from './ImagePanZoomViewer';
import { PdfCanvasViewer } from './PdfCanvasViewer';

export type AssetViewerInk =
  | ({
      kind: 'session';
      activeAttemptId: string | null;
      studyAiConversationKey?: string | null;
    } & Extract<InkHydrateInput, { kind: 'session' }>)
  | ({
      kind: 'asset';
      activeAttemptId?: string | null;
      readonly: boolean;
      studyAiConversationKey?: string | null;
    } & Extract<InkHydrateInput, { kind: 'asset' }>);

export function AssetViewer(props: {
  title: string;
  file: AssetFile;
  pdfData: Uint8Array | null;
  pageNumber: number;
  onPageNumberChange: (n: number) => void;
  accentColor?: string;
  ink?: AssetViewerInk | null;
}) {
  const mime = props.file.mimeType || '';
  const isPdf =
    mime === 'application/pdf' || props.file.originalName.toLowerCase().endsWith('.pdf');
  const isImage = mime.startsWith('image/');

  const objectUrl = useMemo(() => {
    if (!isImage) return null;
    return URL.createObjectURL(props.file.blob);
  }, [isImage, props.file.blob]);

  useEffect(() => {
    if (!objectUrl) return;
    return () => URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  if (isPdf) {
    if (!props.pdfData) {
      return (
        <ErrorPage
          title="PDF nicht geladen"
          message="PDF Daten fehlen oder konnten nicht gelesen werden."
        />
      );
    }
    return (
      <PdfCanvasViewer
        data={props.pdfData}
        pageNumber={props.pageNumber}
        onPageNumberChange={props.onPageNumberChange}
        accentColor={props.accentColor}
        ink={props.ink ?? null}
      />
    );
  }

  if (isImage && objectUrl) {
    return <ImagePanZoomViewer src={objectUrl} alt={props.title} accentColor={props.accentColor} />;
  }

  return (
    <ErrorPage
      title="Dateiformat nicht unterstützt"
      message={`Kann diese Datei in-app nicht anzeigen (${mime || 'unknown'}).`}
    />
  );
}
