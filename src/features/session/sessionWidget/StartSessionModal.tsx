import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Modal } from '../../../components/Modal'
import type { Subject, Topic } from '../../../domain/models'
import { useActiveSessionStore } from '../../../stores/activeSessionStore'
import { useSubjectsStore } from '../../../stores/subjectsStore'
import { useTopicsStore } from '../../../stores/topicsStore'

export function StartSessionModal(props: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const { start } = useActiveSessionStore()
  const { subjects, loading, error, refresh } = useSubjectsStore()
  const { topicsBySubject, loadingBySubject, errorBySubject, refreshBySubject } =
    useTopicsStore()

  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('')
  const [selectedTopicId, setSelectedTopicId] = useState<string>('')
  const [plannedMinutes, setPlannedMinutes] = useState<string>('') 

  const topics: Topic[] = selectedSubjectId ? topicsBySubject[selectedSubjectId] ?? [] : []
  const topicsLoading = selectedSubjectId
    ? (loadingBySubject[selectedSubjectId] ?? false)
    : false
  const topicsError = selectedSubjectId ? errorBySubject[selectedSubjectId] : undefined

  useEffect(() => {
    if (!props.open) return
    void refresh()
  }, [props.open, refresh])

  useEffect(() => {
    if (!props.open) return
    if (!selectedSubjectId) return
    void refreshBySubject(selectedSubjectId)
  }, [props.open, selectedSubjectId, refreshBySubject])

  const plannedDurationMs = useMemo(() => {
    const trimmed = plannedMinutes.trim()
    if (!trimmed) return undefined
    const n = Number(trimmed)
    if (!Number.isFinite(n) || n <= 0) return undefined
    return Math.round(n * 60_000)
  }, [plannedMinutes])

  const canStart = !!selectedSubjectId && !!selectedTopicId

  return (
    <Modal
      open={props.open}
      title="Session starten"
      onClose={props.onClose}
      footer={
        <>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-50 hover:bg-slate-700"
          >
            Abbrechen
          </button>
          <button
            type="button"
            disabled={!canStart}
            onClick={() => {
              if (!canStart) return
              start({
                subjectId: selectedSubjectId,
                topicId: selectedTopicId,
                plannedDurationMs,
              })
              props.onClose()
              navigate(`/subjects/${selectedSubjectId}/topics/${selectedTopicId}`)
            }}
            className="rounded-md bg-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-60"
          >
            Starten
          </button>
        </>
      }
    >
      {error ? (
        <div className="mb-3 rounded-md border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        <label className="block">
          <div className="text-xs font-semibold text-slate-300">Fach</div>
          <select
            value={selectedSubjectId}
            onChange={(e) => {
              const next = e.target.value
              setSelectedSubjectId(next)
              setSelectedTopicId('')
            }}
            className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
            disabled={loading}
          >
            <option value="" disabled>
              {loading ? 'Lade…' : 'Bitte wählen'}
            </option>
            {subjects.map((s: Subject) => (
              <option key={s.id} value={s.id}>
                {s.iconEmoji ? `${s.iconEmoji} ` : ''}
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="text-xs font-semibold text-slate-300">Thema</div>
          <select
            value={selectedTopicId}
            onChange={(e) => setSelectedTopicId(e.target.value)}
            className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
            disabled={!selectedSubjectId || topicsLoading}
          >
            <option value="" disabled>
              {!selectedSubjectId
                ? 'Erst Fach wählen'
                : topicsLoading
                  ? 'Lade…'
                  : 'Bitte wählen'}
            </option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.iconEmoji ? `${t.iconEmoji} ` : ''}
                {t.name}
              </option>
            ))}
          </select>
          {topicsError ? (
            <div className="mt-2 text-xs text-rose-200">{topicsError}</div>
          ) : null}
        </label>

        <label className="block">
          <div className="text-xs font-semibold text-slate-300">
            Geplante Dauer (Minuten, optional)
          </div>
          <input
            inputMode="numeric"
            value={plannedMinutes}
            onChange={(e) => setPlannedMinutes(e.target.value)}
            placeholder="z.B. 25"
            className="mt-1 w-full rounded-md border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-50 outline-none ring-indigo-500/30 focus:ring-2"
          />
          <div className="mt-2 text-xs text-slate-400">
            Wenn gesetzt, zählt der Timer runter bis 0 und danach die Überzeit hoch.
          </div>
        </label>
      </div>
    </Modal>
  )
}

