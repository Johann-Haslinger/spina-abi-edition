import { db } from '../../db/db';
import type { OpenAiPdfFileCache } from '../../domain/models';

export class LocalOpenAiPdfFileCacheRepository {
  async get(pdfSha256: string): Promise<OpenAiPdfFileCache | undefined> {
    return await db.openAiPdfFileCache.get(pdfSha256);
  }

  async upsert(input: OpenAiPdfFileCache): Promise<void> {
    await db.openAiPdfFileCache.put(input);
  }

  async delete(pdfSha256: string): Promise<void> {
    await db.openAiPdfFileCache.delete(pdfSha256);
  }
}
