import type { AssetFile } from '../domain/models';

export function formatAssetFileLabel(file: AssetFile | null | undefined): string {
  if (!file) return '';
  const mime = file.mimeType || '';
  const lower = file.originalName.toLowerCase();
  if (mime === 'application/pdf' || lower.endsWith('.pdf')) return 'PDF-Dokument';
  if (mime === 'image/png' || lower.endsWith('.png')) return 'PNG-Bild';
  if (
    mime === 'image/jpeg' ||
    mime === 'image/jpg' ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg')
  ) {
    return 'JPEG-Bild';
  }
  if (mime === 'image/webp' || lower.endsWith('.webp')) return 'WebP-Bild';
  if (mime.startsWith('image/')) return 'Bild';
  return file.originalName || mime || 'Datei';
}

export function safeDownloadBasename(title: string): string {
  const t = title.trim() || 'uebung';
  return t.replace(/[<>:"/\\|?*]/g, '_').slice(0, 120);
}
