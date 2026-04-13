import type { LearnPathProgress } from '../../../../../domain/models';
import { PrimaryButton, SecondaryButton } from '../../../../../components/Button';
import type { LearnPathRequirementOverviewItem } from '../types';

export function LearnPathOverview(props: {
  items: LearnPathRequirementOverviewItem[];
  latestInProgress?: LearnPathProgress;
  firstOpenRequirement?: LearnPathRequirementOverviewItem;
  onResumeLatest: () => void;
  onStartRequirement: (item: LearnPathRequirementOverviewItem, mode: 'learn' | 'review') => void;
  materialBusy: boolean;
  materialError: string | null;
  materialLastMatches: Array<{
    requirementId: string;
    summary: string;
    sourceName?: string;
  }>;
  onScanMaterialFiles: (files: File[]) => void;
}) {
  const groups = new Map<string, LearnPathRequirementOverviewItem[]>();
  for (const item of props.items) {
    const key = item.chapter.id;
    const current = groups.get(key) ?? [];
    current.push(item);
    groups.set(key, current);
  }

  return (
    <section className="space-y-5 pt-10">
      <div className="rounded-4xl border border-white/8 bg-white/4 p-6">
        <div className="text-xs uppercase tracking-wide text-white/45">Startseite</div>
        <div className="mt-2 text-2xl font-semibold text-white">Wissenspfad Requirements</div>
        <div className="mt-2 max-w-3xl text-sm text-white/70">
          Waehle ein offenes Requirement zum Lernen oder wiederhole bereits abgehakte Inhalte,
          um sie weiter zu festigen.
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {props.latestInProgress ? (
            <PrimaryButton onClick={props.onResumeLatest}>Letzte Session fortsetzen</PrimaryButton>
          ) : null}
          {props.firstOpenRequirement ? (
            <SecondaryButton
              onClick={() => props.onStartRequirement(props.firstOpenRequirement!, 'learn')}
            >
              Naechstes offenes Requirement
            </SecondaryButton>
          ) : null}
        </div>
      </div>

      <section className="rounded-4xl border border-white/8 bg-slate-950/20 p-5 space-y-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-white/45">Unterrichtsmaterial</div>
          <div className="mt-2 text-lg font-semibold text-white">PDFs automatisch verarbeiten</div>
          <div className="mt-2 text-sm text-white/70">
            Lade Unterrichts-PDFs hoch. Die KI erstellt pro betroffenem Requirement eine
            Zusammenfassung und hängt sie direkt an den Requirement-Kontext an.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center rounded-full border border-white/15 bg-white/8 px-4 py-2 text-sm text-white hover:bg-white/12">
            PDFs auswählen und scannen
            <input
              type="file"
              className="hidden"
              accept="application/pdf,.pdf"
              multiple
              disabled={props.materialBusy}
              onChange={(event) => {
                const files = event.currentTarget.files ? Array.from(event.currentTarget.files) : [];
                if (files.length > 0) props.onScanMaterialFiles(files);
                event.currentTarget.value = '';
              }}
            />
          </label>
          {props.materialBusy ? <div className="text-xs text-white/60">Analyse läuft…</div> : null}
        </div>
        {props.materialError ? (
          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {props.materialError}
          </div>
        ) : null}
        {props.materialLastMatches.length > 0 ? (
          <div className="space-y-3">
            {props.materialLastMatches.map((match, index) => (
              <div
                key={`${match.requirementId}-${match.sourceName ?? 'source'}-${index}`}
                className="rounded-3xl border border-white/8 bg-white/5 px-4 py-3 space-y-3"
              >
                <div className="text-sm text-white/90">{match.summary}</div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
                  {match.sourceName ? <span>Quelle: {match.sourceName}</span> : null}
                  <span>
                    →{' '}
                    {props.items.find((item) => item.requirement.id === match.requirementId)?.requirement.name ??
                      match.requirementId}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-white/55">
            Nach einem Scan siehst du hier, welche Requirement-Kontexte gerade automatisch erweitert
            wurden.
          </div>
        )}
      </section>

      {Array.from(groups.values()).map((items) => {
        const chapter = items[0]?.chapter;
        if (!chapter) return null;

        return (
          <section key={chapter.id} className="rounded-4xl border border-white/8 bg-slate-950/20 p-5">
            <div className="text-xs uppercase tracking-wide text-white/45">Kapitel</div>
            <div className="mt-2 text-xl font-semibold text-white">{chapter.name}</div>
            <div className="mt-4 space-y-3">
              {items.map((item) => {
                const learnCompleted = item.learnProgress?.status === 'completed';
                const canResumeLearn = item.learnProgress?.status === 'in_progress';
                const canResumeReview = item.reviewProgress?.status === 'in_progress';
                const canReview = learnCompleted;

                return (
                  <div
                    key={item.requirement.id}
                    className="rounded-3xl border border-white/8 bg-white/5 px-4 py-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="font-medium text-white">{item.requirement.name}</div>
                          <StatusChip status={item.status} />
                        </div>
                        {item.requirement.description ? (
                          <div className="mt-2 text-sm text-white/65">
                            {item.requirement.description}
                          </div>
                        ) : null}
                        {item.requirement.materialContext ? (
                          <div className="mt-2 text-xs text-cyan-100/80">
                            Kontext vorhanden (
                            {item.requirement.materialContextSources?.length ?? 0} PDF-Beiträge)
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {canResumeLearn ? (
                          <PrimaryButton onClick={() => props.onStartRequirement(item, 'learn')}>
                            Lernen fortsetzen
                          </PrimaryButton>
                        ) : !learnCompleted ? (
                          <PrimaryButton onClick={() => props.onStartRequirement(item, 'learn')}>
                            Lernen
                          </PrimaryButton>
                        ) : null}

                        {canResumeReview ? (
                          <SecondaryButton onClick={() => props.onStartRequirement(item, 'review')}>
                            Wiederholung fortsetzen
                          </SecondaryButton>
                        ) : canReview ? (
                          <SecondaryButton onClick={() => props.onStartRequirement(item, 'review')}>
                            Wiederholen
                          </SecondaryButton>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </section>
  );
}

function StatusChip(props: { status: LearnPathRequirementOverviewItem['status'] }) {
  const labels: Record<LearnPathRequirementOverviewItem['status'], string> = {
    open: 'Offen',
    in_progress: 'In Bearbeitung',
    completed: 'Abgeschlossen',
    reviewing: 'Wiederholung laeuft',
  };

  const className =
    props.status === 'completed'
      ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
      : props.status === 'reviewing'
        ? 'border-violet-400/20 bg-violet-500/10 text-violet-100'
        : props.status === 'in_progress'
          ? 'border-cyan-400/20 bg-cyan-500/10 text-cyan-100'
          : 'border-white/10 bg-white/5 text-white/70';

  return (
    <span className={`rounded-full border px-2 py-1 text-[11px] ${className}`}>
      {labels[props.status]}
    </span>
  );
}
