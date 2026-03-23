import { create } from 'zustand';
import type { Chapter, CurriculumDocument, Requirement } from '../domain/models';
import {
  assetFileStore,
  assetRepo,
  chapterRepo,
  curriculumDocumentRepo,
  requirementRepo,
  subjectRepo,
  topicRepo,
} from '../repositories';
import {
  generateChapterExplanationWithAi,
  importCurriculumWithAi,
} from '../features/session/ai/aiClient';

type CurriculumState = {
  documentsBySubject: Record<string, CurriculumDocument[]>;
  chaptersByTopic: Record<string, Chapter[]>;
  requirementsByTopic: Record<string, Requirement[]>;
  loadingBySubject: Record<string, boolean>;
  loadingByTopic: Record<string, boolean>;
  errorBySubject: Record<string, string | undefined>;
  errorByTopic: Record<string, string | undefined>;
  refreshSubjectDocuments: (subjectId: string) => Promise<void>;
  refreshTopicCurriculum: (topicId: string) => Promise<void>;
  importCurriculum: (input: { subjectId: string; file: File }) => Promise<void>;
  generateChapterExplanation: (input: {
    subjectId: string;
    topicId: string;
    chapterId: string;
  }) => Promise<string>;
};

export const useCurriculumStore = create<CurriculumState>((set, get) => ({
  documentsBySubject: {},
  chaptersByTopic: {},
  requirementsByTopic: {},
  loadingBySubject: {},
  loadingByTopic: {},
  errorBySubject: {},
  errorByTopic: {},

  refreshSubjectDocuments: async (subjectId) => {
    set((state) => ({
      loadingBySubject: { ...state.loadingBySubject, [subjectId]: true },
      errorBySubject: { ...state.errorBySubject, [subjectId]: undefined },
    }));
    try {
      const documents = await curriculumDocumentRepo.listBySubject(subjectId);
      set((state) => ({
        documentsBySubject: { ...state.documentsBySubject, [subjectId]: documents },
        loadingBySubject: { ...state.loadingBySubject, [subjectId]: false },
      }));
    } catch (error) {
      set((state) => ({
        loadingBySubject: { ...state.loadingBySubject, [subjectId]: false },
        errorBySubject: {
          ...state.errorBySubject,
          [subjectId]: error instanceof Error ? error.message : 'Fehler beim Laden',
        },
      }));
    }
  },

  refreshTopicCurriculum: async (topicId) => {
    set((state) => ({
      loadingByTopic: { ...state.loadingByTopic, [topicId]: true },
      errorByTopic: { ...state.errorByTopic, [topicId]: undefined },
    }));
    try {
      const chapters = await chapterRepo.listByTopic(topicId);
      const requirements = await requirementRepo.listByChapterIds(chapters.map((chapter) => chapter.id));
      set((state) => ({
        chaptersByTopic: { ...state.chaptersByTopic, [topicId]: chapters },
        requirementsByTopic: { ...state.requirementsByTopic, [topicId]: requirements },
        loadingByTopic: { ...state.loadingByTopic, [topicId]: false },
      }));
    } catch (error) {
      set((state) => ({
        loadingByTopic: { ...state.loadingByTopic, [topicId]: false },
        errorByTopic: {
          ...state.errorByTopic,
          [topicId]: error instanceof Error ? error.message : 'Fehler beim Laden',
        },
      }));
    }
  },

  importCurriculum: async ({ subjectId, file }) => {
    const subject = await subjectRepo.get(subjectId);
    if (!subject) throw new Error('Fach nicht gefunden');
    const processingDoc = await curriculumDocumentRepo.create({
      subjectId,
      sourceName: file.name,
      status: 'processing',
    });
    await get().refreshSubjectDocuments(subjectId);

    try {
      const imported = await importCurriculumWithAi({ subjectName: subject.name, file });
      const existingTopics = await topicRepo.listBySubject(subjectId);
      for (const topic of existingTopics) {
        await topicRepo.delete(topic.id);
      }

      for (const [topicIndex, importedTopic] of imported.topics.entries()) {
        const createdTopic = await topicRepo.create({
          subjectId,
          name: importedTopic.name || `Thema ${topicIndex + 1}`,
          iconEmoji: importedTopic.iconEmoji,
        });

        for (const [chapterIndex, importedChapter] of importedTopic.chapters.entries()) {
          const createdChapter = await chapterRepo.create({
            topicId: createdTopic.id,
            name: importedChapter.name || `Kapitel ${chapterIndex + 1}`,
            description: importedChapter.description,
            orderIndex: chapterIndex,
          });

          for (const requirement of importedChapter.requirements) {
            await requirementRepo.create({
              chapterId: createdChapter.id,
              name: requirement.name,
              description: requirement.description,
              difficulty: requirement.difficulty,
            });
          }
        }
      }

      await curriculumDocumentRepo.update(processingDoc.id, {
        status: 'ready',
        outlineJson: JSON.stringify(imported),
        error: undefined,
      });
      await get().refreshSubjectDocuments(subjectId);
    } catch (error) {
      await curriculumDocumentRepo.update(processingDoc.id, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Import fehlgeschlagen',
      });
      await get().refreshSubjectDocuments(subjectId);
      throw error;
    }
  },

  generateChapterExplanation: async ({ subjectId, topicId, chapterId }) => {
    const subject = await subjectRepo.get(subjectId);
    const topic = await topicRepo.get(topicId);
    if (!subject || !topic) throw new Error('Kontext für Kapitel-Erklärung fehlt');

    const chapters = get().chaptersByTopic[topicId] ?? (await chapterRepo.listByTopic(topicId));
    const chapter = chapters.find((entry) => entry.id === chapterId);
    if (!chapter) throw new Error('Kapitel nicht gefunden');

    const requirements =
      get().requirementsByTopic[topicId] ??
      (await requirementRepo.listByChapterIds(chapters.map((entry) => entry.id)));
    const chapterRequirements = requirements.filter((requirement) => requirement.chapterId === chapterId);

    const { title, markdown } = await generateChapterExplanationWithAi({
      subjectName: subject.name,
      topicName: topic.name,
      chapterName: chapter.name,
      chapterDescription: chapter.description,
      requirements: chapterRequirements,
      weakRequirementNames: chapterRequirements
        .filter((requirement) => requirement.mastery < 0.7)
        .map((requirement) => requirement.name),
    });

    const asset = await assetRepo.create({
      subjectId,
      topicId,
      type: 'cheatsheet',
      title,
    });
    const file = new File([markdown], `${slugify(title)}.md`, { type: 'text/markdown' });
    await assetFileStore.put(asset.id, file);
    await chapterRepo.update(chapterId, { explanationAssetId: asset.id });
    await get().refreshTopicCurriculum(topicId);
    return asset.id;
  },
}));

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
