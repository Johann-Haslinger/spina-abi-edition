import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSubjectsStore } from '../../stores/subjectsStore'

export function CollectionPage() {
  const { subjects, loading, error, refresh } = useSubjectsStore()

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Collection</h1>
        <p className="mt-1 text-sm text-slate-400">
          Alle Fächer auf einen Blick.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-200">Fächer</div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-50 hover:bg-slate-700"
          >
            Aktualisieren
          </button>
        </div>

        {error ? (
          <div className="mt-3 rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-3 text-sm text-slate-400">Lade…</div>
        ) : subjects.length === 0 ? (
          <div className="mt-3 text-sm text-slate-400">
            Noch keine Fächer. Lege dein erstes Fach im Dashboard an.
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {subjects.map((s) => (
              <li
                key={s.id}
                className="rounded-xl border border-slate-800 bg-slate-950/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {s.iconEmoji ? (
                        <span className="text-base leading-none" aria-hidden>
                          {s.iconEmoji}
                        </span>
                      ) : null}
                      <span
                        className="mt-0.5 inline-block h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: s.color }}
                        aria-hidden
                      />
                      <Link
                        to={`/subjects/${s.id}`}
                        className="truncate text-sm font-semibold text-slate-50 hover:underline"
                      >
                        {s.name}
                      </Link>
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      Öffnen, um Themen und Assets zu sehen.
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

