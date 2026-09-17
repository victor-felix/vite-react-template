import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { GitlabApiError } from '../lib/gitlabApi'
import { getSprintVelocityHistory, type SprintVelocity } from '../lib/velocity'
import type { GitlabConfig } from '../types/gitlab'

function shortenTitle(title: string): string {
  return title.length > 14 ? `${title.slice(0, 13)}…` : title
}

interface ChartRow {
  milestone: string
  fullTitle: string
  delivered: number
  total: number
}

function VelocityTooltip({ active, payload }: { active?: boolean; payload?: { payload: ChartRow }[] }) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0].payload
  return (
    <div
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '0.5rem 0.7rem',
        fontSize: '0.8rem',
        color: 'var(--text-primary)',
      }}
    >
      <div style={{ marginBottom: 4 }}>{row.fullTitle}</div>
      <strong>
        {row.delivered} de {row.total} pontos
      </strong>
    </div>
  )
}

export function VelocityHistory({ config }: { config: GitlabConfig }) {
  const [velocities, setVelocities] = useState<SprintVelocity[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const pointsConfigured = Boolean(config.pointLabelPrefix.trim())

  useEffect(() => {
    if (!pointsConfigured) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    getSprintVelocityHistory(config)
      .then((result) => {
        if (!cancelled) setVelocities(result)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof GitlabApiError ? err.message : 'Erro ao buscar o histórico de sprints.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [config, pointsConfigured])

  const rows: ChartRow[] =
    velocities?.map((v) => ({
      milestone: shortenTitle(v.milestone.title),
      fullTitle: v.milestone.title,
      delivered: v.completedPoints,
      total: v.totalPoints,
    })) ?? []

  return (
    <section className="card">
      <div className="milestone-header">
        <h2>Histórico de velocidade</h2>
        <span className="milestone-meta">pontos entregues por sprint encerrada</span>
      </div>

      {!pointsConfigured && (
        <p className="milestone-meta">
          Configure o prefixo da label de pontuação nas Configurações para ver o histórico de
          velocidade.
        </p>
      )}

      {pointsConfigured && loading && <div className="spinner-row">Carregando histórico…</div>}
      {pointsConfigured && error && <div className="banner banner-error">{error}</div>}

      {pointsConfigured && !loading && !error && rows.length === 0 && (
        <p className="milestone-meta">Nenhuma milestone encerrada neste projeto ainda.</p>
      )}

      {pointsConfigured && !loading && !error && rows.length > 0 && (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--gridline)" vertical={false} />
            <XAxis
              dataKey="milestone"
              stroke="var(--baseline)"
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            />
            <YAxis
              allowDecimals={false}
              stroke="var(--baseline)"
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              width={36}
            />
            <Tooltip content={<VelocityTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
            <Bar dataKey="delivered" fill="var(--series-actual)" radius={[4, 4, 0, 0]} maxBarSize={48} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </section>
  )
}
