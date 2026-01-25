import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-50">
        Seite nicht gefunden
      </h1>
      <p className="text-sm text-slate-400">
        Der Link ist ungültig oder die Seite existiert noch nicht.
      </p>
      <Link
        to="/dashboard"
        className="inline-flex rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-slate-700"
      >
        Zurück zum Dashboard
      </Link>
    </div>
  )
}

