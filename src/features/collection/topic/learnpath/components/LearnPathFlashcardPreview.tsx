export type LearnPathFlashcardPreviewItem = {
  id: string;
  front: string;
  back: string;
  chapterId?: string;
  requirementId?: string;
};

export type LearnPathFlashcardPreviewPatch = Partial<
  Pick<LearnPathFlashcardPreviewItem, 'front' | 'back' | 'chapterId' | 'requirementId'>
>;

type LearnPathFlashcardPreviewProps = {
  flashcards: LearnPathFlashcardPreviewItem[];
  onUpdate: (flashcardId: string, patch: LearnPathFlashcardPreviewPatch) => void;
  title?: string;
  description?: string;
};

export function LearnPathFlashcardPreview(props: LearnPathFlashcardPreviewProps) {
  const { flashcards, onUpdate, title = 'Generierte Karteikarten', description } = props;
  if (flashcards.length === 0) return null;

  return (
    <div className="space-y-3 rounded-4xl border border-white/8 bg-white/4 p-4">
      <div className="text-sm font-medium text-white">{title}</div>
      {description ? (
        <div className="-mt-1 pb-2 text-sm text-white/65">{description}</div>
      ) : (
        <div className="-mt-1 pb-2 text-sm text-white/65">
          Du kannst die Karten vor dem Speichern noch anpassen.
        </div>
      )}
      {flashcards.map((flashcard) => (
        <div
          key={flashcard.id}
          className="space-y-3 divide-y divide-white/10 rounded-3xl border border-white/8 bg-black/15 p-4"
        >
          <label className="block space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-white/45">
              Vorderseite
            </span>
            <textarea
              value={flashcard.front}
              rows={3}
              onChange={(event) =>
                onUpdate(flashcard.id, {
                  front: event.currentTarget.value,
                })
              }
              className="w-full resize-y rounded-xl border border-white/6 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/15"
              placeholder="Vorderseite"
            />
          </label>
          <label className="block space-y-1.5 pt-3">
            <span className="text-xs font-medium uppercase tracking-wide text-white/45">
              Rueckseite
            </span>
            <textarea
              value={flashcard.back}
              rows={4}
              onChange={(event) =>
                onUpdate(flashcard.id, {
                  back: event.currentTarget.value,
                })
              }
              className="w-full resize-y rounded-xl border border-white/6 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/15"
              placeholder="Rueckseite"
            />
          </label>
        </div>
      ))}
    </div>
  );
}
