import { useEffect, useState } from 'react'
import { BurndownChart } from './BurndownChart'
import { computeMilestoneBurndown, type MilestoneBurndown } from '../lib/burndown'
import { GitlabApiError } from '../lib/gitlabApi'
import type { GitlabConfig, GitlabMilestone } from '../types/gitlab'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
}

export function MilestoneCard({ config, milestone }: { config: GitlabConfig; milestone: GitlabMilestone }) {
  const [burndown, setBurndown] = useState<MilestoneBurndown | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    computeMilestoneBurndown(config, milestone)
      .then((result) => {
        if (!cancelled) setBurndown(result)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof GitlabApiError ? err.message : 'Erro ao calcular o burndown desta milestone.')
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

  const percentDone =
    burndown && burndown.totalIssues > 0
      ? Math.round((burndown.completedIssues / burndown.totalIssues) * 100)
      : 0

  return (
    <section className="card milestone-card">
      <div className="milestone-header">
        <h2>
          <a href={milestone.web_url} target="_blank" rel="noreferrer">
            {milestone.title}
          </a>
        </h2>
        <span className="milestone-meta">
          {formatDate(milestone.start_date)} → {formatDate(milestone.due_date)}
        </span>
      </div>

      {loading && <div className="spinner-row">Calculando burndown…</div>}
      {error && <div className="banner banner-error">{error}</div>}

      {!loading && !error && burndown && burndown.totalIssues === 0 && (
        <p className="milestone-meta">Nenhuma tarefa associada a esta milestone.</p>
      )}

      {!loading && !error && burndown && burndown.totalIssues > 0 && (
        <>
          <div className="milestone-stats">
            <div className="stat">
              <span className="value">{burndown.totalIssues}</span>
              <span className="label">Tarefas</span>
            </div>
            <div className="stat">
              <span className="value">{burndown.completedIssues}</span>
              <span className="label">Finalizadas</span>
            </div>
            <div className="stat">
              <span className="value">{percentDone}%</span>
              <span className="label">Concluído</span>
            </div>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${percentDone}%` }} />
          </div>
          {!burndown.hasDueDate && (
            <p className="hint" style={{ marginBottom: '0.75rem', display: 'block' }}>
              Esta milestone não tem data de término definida, então a linha ideal não é exibida.
            </p>
          )}
          <BurndownChart points={burndown.points} hasDueDate={burndown.hasDueDate} />
        </>
      )}
    </section>
  )
}
