import type { ReactNode } from 'react';
import type { ReviewSummaryResponse } from '../ai/reviewSummaryTypes';

export function AiReviewSummaryCard(props: {
  loading: boolean;
  error: string | null;
  data: ReviewSummaryResponse | null;
  fallback?: ReactNode;
  className?: string;
  details?: ReactNode;
}) {
  const { loading, error, data, fallback, className = '', details } = props;

  if (loading) {
    return (
      <div
        className={`rounded-xl border border-white/10 bg-white/3 p-4 animate-pulse ${className}`}
      >
        <div className="h-3 w-28 rounded bg-white/10" />
        <div className="mt-3 space-y-2">
          <div className="h-3 w-full rounded bg-white/10" />
          <div className="h-3 w-4/5 rounded bg-white/10" />
          <div className="h-3 w-2/3 rounded bg-white/10" />
        </div>
      </div>
    );
  }

  if (data) {
    return (
      <div className={`text-left ${className}`}>
        <div className="text-xs font-semibold uppercase tracking-wide text-white/40">
          KI-Zusammenfassung
        </div>
        <h3 className="mt-2 text-xl font-semibold text-white">{data.headline}</h3>
        {details ? <div className="mt-4">{details}</div> : null}
        <p className="mt-4 text-sm text-white/80 whitespace-pre-wrap leading-relaxed">
          {data.summary}
        </p>
        <div className="mt-4 rounded-lg border border-amber-500/15 bg-amber-950/25 px-3 py-2">
          <div className="text-xs font-semibold text-amber-100/90">Tipp</div>
          <p className="mt-1 text-sm text-amber-50/90">{data.tip}</p>
        </div>
        {data.focusAreas.length ? (
          <div className="mt-4">
            <div className="text-xs font-semibold text-white/50">Worauf du achten solltest</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-white/75">
              {data.focusAreas.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-white/10 bg-white/[0.03] p-4 ${className}`}>
      {error ? <div className="text-xs text-rose-200/90 mb-2">{error}</div> : null}
      {fallback ? <div className="text-sm text-white/75">{fallback}</div> : null}
    </div>
  );
}
