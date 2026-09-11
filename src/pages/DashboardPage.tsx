import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useConfig } from '../lib/config'
import { GitlabApiError, getActiveMilestones } from '../lib/gitlabApi'
import { MilestoneCard } from '../components/MilestoneCard'
import type { GitlabMilestone } from '../types/gitlab'

export function DashboardPage() {
  const { config } = useConfig()
  const [milestones, setMilestones] = useState<GitlabMilestone[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!config) return
    let cancelled = false
    setLoading(true)
    setError(null)
    getActiveMilestones(config)
      .then((result) => {
        if (!cancelled) setMilestones(result)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof GitlabApiError ? err.message : 'Erro ao buscar milestones do GitLab.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [config])

  if (!config) {
    return (
      <div className="empty-state card">
        <h1>Nenhum projeto configurado</h1>
        <p>Configure a URL do GitLab, o token de acesso e o projeto para ver o relatório.</p>
        <Link to="/settings" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Ir para configurações
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="page-header">
        <h1>Relatório de burndown</h1>
        <p>Milestones em andamento em {config.projectPath}, com base na coluna "{config.doneLabel}".</p>
      </div>

      {loading && <div className="spinner-row">Carregando milestones…</div>}
      {error && <div className="banner banner-error">{error}</div>}

      {!loading && !error && milestones && milestones.length === 0 && (
        <div className="empty-state card">
          <p>Nenhuma milestone em andamento neste projeto.</p>
        </div>
      )}

      {milestones?.map((milestone) => (
        <MilestoneCard key={milestone.id} config={config} milestone={milestone} />
      ))}
    </>
  )
}
