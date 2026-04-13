import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { IoChevronBack } from 'react-icons/io5';
import { PrimaryButton, SecondaryButton } from '../../../../components/Button';
import { ViewerIconButton } from '../../../../components/ViewerIconButton';
import type { Flashcard } from '../../../../domain/models';
import { flashcardRepo } from '../../../../repositories';
import { applyFlashcardReview } from './flashcardSrs';

type FlashcardReviewSessionProps = {
  cards: Flashcard[];
  onBack: () => void;
};

export function FlashcardReviewSession(props: FlashcardReviewSessionProps) {
  const { cards, onBack } = props;
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [saving, setSaving] = useState(false);

  const current = cards[index];

  useEffect(() => {
    setFlipped(false);
  }, [index]);

  const handleRate = useCallback(
    async (rating: 'known' | 'unknown') => {
      if (!current || saving) return;
      setSaving(true);
      const now = Date.now();
      try {
        const next = applyFlashcardReview(current, rating, now);
        await flashcardRepo.upsert({
          ...next,
          id: next.id,
          createdAtMs: next.createdAtMs,
          updatedAtMs: next.updatedAtMs,
        });
        setIndex((i) => i + 1);
      } finally {
        setSaving(false);
      }
    },
    [current, saving],
  );

  const done = index >= cards.length;
  const showEmpty = cards.length === 0;

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col">
      <ViewerIconButton ariaLabel="Zurück" onClick={onBack} className="fixed left-6 top-6 z-10">
        <IoChevronBack />
      </ViewerIconButton>

      <div className="flex flex-1 flex-col items-center justify-center px-4 pb-8 pt-20">
        {showEmpty ? (
          <p className="max-w-md text-center text-sm text-white/60">
            Keine Karten fuer diese Abfrage. Lege Karten an oder waehle einen anderen Modus.
          </p>
        ) : done ? (
          <div className="max-w-md space-y-3 text-center">
            <p className="text-lg font-semibold text-white">Fertig</p>
            <p className="text-sm text-white/60">
              {cards.length > 0
                ? `${cards.length} Karte${cards.length === 1 ? '' : 'n'} bearbeitet.`
                : null}
            </p>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-white/45">
              Karte {index + 1} von {cards.length}
            </p>

            <div
              className="mx-auto w-full max-w-xl"
              style={{ perspective: 1200 }}
            >
              <motion.button
                type="button"
                className="relative h-[min(52vh,400px)] w-full cursor-pointer border-0 bg-transparent p-0 text-left outline-none"
                style={{ transformStyle: 'preserve-3d' }}
                animate={{ rotateY: flipped ? 180 : 0 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => setFlipped((f) => !f)}
                aria-label={flipped ? 'Karte umdrehen zur Frage' : 'Karte umdrehen zur Antwort'}
              >
                <div
                  className="absolute inset-0 flex flex-col overflow-hidden rounded-[2rem] border border-white/12 bg-white/[0.06] p-6 shadow-xl backdrop-blur-sm"
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(0deg)',
                  }}
                >
                  <span className="text-xs font-medium uppercase tracking-wide text-white/40">
                    Frage
                  </span>
                  <div className="mt-4 min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap text-xl font-semibold leading-snug text-white">
                    {current.front}
                  </div>
                </div>
                <div
                  className="absolute inset-0 flex flex-col overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-emerald-950/35 p-6 shadow-xl backdrop-blur-sm"
                  style={{
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                  }}
                >
                  <span className="text-xs font-medium uppercase tracking-wide text-emerald-200/70">
                    Antwort
                  </span>
                  <div className="mt-4 min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap text-base leading-relaxed text-white/95">
                    {current.back}
                  </div>
                </div>
              </motion.button>
            </div>

            <div className="mt-10 flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
              <SecondaryButton
                className="min-h-[44px] flex-1 sm:flex-none sm:min-w-[140px]"
                onClick={() => setFlipped((f) => !f)}
              >
                {flipped ? 'Frage zeigen' : 'Aufdecken'}
              </SecondaryButton>
              <SecondaryButton
                className="min-h-[44px] flex-1 border-rose-400/35 text-rose-100 hover:bg-rose-500/15 sm:flex-none sm:min-w-[140px]"
                disabled={!flipped || saving}
                onClick={() => void handleRate('unknown')}
              >
                Falsch
              </SecondaryButton>
              <PrimaryButton
                className="min-h-[44px] flex-1 sm:flex-none sm:min-w-[140px]"
                disabled={!flipped || saving}
                onClick={() => void handleRate('known')}
              >
                Richtig
              </PrimaryButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
