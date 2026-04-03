import { PDFDocument } from 'pdf-lib';

export async function embedRasterBytesInPdf(
  imageBytes: Uint8Array,
  kind: 'png' | 'jpeg',
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const image =
    kind === 'jpeg' ? await pdfDoc.embedJpg(imageBytes) : await pdfDoc.embedPng(imageBytes);
  const page = pdfDoc.addPage([image.width, image.height]);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: image.width,
    height: image.height,
  });
  return pdfDoc.save();
}
