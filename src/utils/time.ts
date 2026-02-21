export function formatDuration(totalSeconds: number, short?: boolean) {
  const seconds = Math.max(0, Math.floor(totalSeconds));

  if (seconds < 60) {
    if (short) {
      return `${seconds} s`;
    }
    return `${seconds} ${seconds === 1 ? 'Sekunde' : 'Sekunden'}`;
  }

  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    if (short) {
      return `${minutes} min`;
    }
    return `${minutes} ${minutes === 1 ? 'Minute' : 'Minuten'}`;
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (short) {
    return `${hours}:${String(minutes).padStart(2, '0')} h`;
  }
  return `${hours}:${String(minutes).padStart(2, '0')} Stunden`;
}

export function formatDurationClock(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatClockTime(ms: number) {
  const hhmm = new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(ms));
  return `${hhmm} Uhr`;
}
