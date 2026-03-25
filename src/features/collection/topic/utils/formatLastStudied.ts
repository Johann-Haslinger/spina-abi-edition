const rtf =
  typeof Intl !== 'undefined'
    ? new Intl.RelativeTimeFormat('de', { numeric: 'auto' })
    : null;

export function formatLastStudied(ms: number): string {
  const diffSec = Math.round((Date.now() - ms) / 1000);
  if (diffSec < 45) return 'gerade eben';
  if (diffSec < 90) return 'vor 1 Minute';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return rtf ? rtf.format(-diffMin, 'minute') : `vor ${diffMin} Min.`;
  }

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) {
    return rtf ? rtf.format(-diffHours, 'hour') : `vor ${diffHours} Std.`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) {
    return rtf ? rtf.format(-diffDays, 'day') : `vor ${diffDays} Tagen`;
  }

  return new Date(ms).toLocaleDateString('de', {
    day: 'numeric',
    month: 'short',
    year: diffDays > 300 ? 'numeric' : undefined,
  });
}
