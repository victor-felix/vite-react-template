import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useConfig } from '../lib/config'
import { GitlabApiError, getActiveMilestones } from '../lib/gitlabApi'
import { isMilestoneInProgress } from '../lib/burndown'
import { MilestoneCard } from '../components/MilestoneCard'
import { OpenMergeRequests } from '../components/OpenMergeRequests'
import { VelocityHistory } from '../components/VelocityHistory'
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
        if (!cancelled) setMilestones(result.filter((m) => isMilestoneInProgress(m)))
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
        <h1>Relatório do projeto</h1>
        <p>{config.projectPath}</p>
      </div>

      <OpenMergeRequests config={config} />

      <div className="page-header" style={{ marginTop: '2rem' }}>
        <h2>Burndown das milestones em andamento</h2>
        <p>
          Com base na(s) coluna(s) "{config.doneLabels.join('", "')}".
        </p>
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

      <div className="page-header" style={{ marginTop: '2rem' }}>
        <h2>Sprints anteriores</h2>
        <p>Pontos (ou tarefas) entregues em cada milestone encerrada.</p>
      </div>

      <VelocityHistory config={config} />
    </>
  )
}
