import { useEffect, useState } from 'react'
import { GanttChart } from './GanttChart'
import { computeMilestoneGantt, type MilestoneGantt } from '../lib/gantt'
import { GitlabApiError } from '../lib/gitlabApi'
import type { GitlabConfig, GitlabMilestone } from '../types/gitlab'

export function MilestoneGanttCard({ config, milestone }: { config: GitlabConfig; milestone: GitlabMilestone }) {
  const [gantt, setGantt] = useState<MilestoneGantt | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    computeMilestoneGantt(config, milestone)
      .then((result) => {
        if (!cancelled) setGantt(result)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof GitlabApiError ? err.message : 'Erro ao montar o cronograma desta milestone.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, milestone.id])

  return (
    <section className="card milestone-card">
      <div className="milestone-header">
        <h2>Cronograma — {milestone.title}</h2>
      </div>

      {loading && <div className="spinner-row">Montando cronograma…</div>}
      {error && <div className="banner banner-error">{error}</div>}

      {!loading && !error && gantt && gantt.bars.length === 0 && (
        <p className="milestone-meta">Nenhuma tarefa associada a esta milestone.</p>
      )}

      {!loading && !error && gantt && gantt.bars.length > 0 && (
        <>
          {config.inProgressLabels.length === 0 && (
            <p className="hint" style={{ marginBottom: '0.75rem', display: 'block' }}>
              Nenhuma coluna "em andamento" configurada — as barras começam na data de início da
              milestone. Configure colunas "em andamento" para datas de início mais precisas.
            </p>
          )}
          <GanttChart bars={gantt.bars} rangeStart={gantt.rangeStart} rangeEnd={gantt.rangeEnd} />
        </>
      )}
    </section>
  )
}
