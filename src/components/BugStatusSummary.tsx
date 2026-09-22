import { useEffect, useState } from 'react'
import { computeBugStatusSummary, type BugStatusSummary as BugStatusSummaryData } from '../lib/bugStatus'
import { GitlabApiError } from '../lib/gitlabApi'
import type { GitlabConfig } from '../types/gitlab'

export function BugStatusSummary({ config }: { config: GitlabConfig }) {
  const [summary, setSummary] = useState<BugStatusSummaryData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    computeBugStatusSummary(config)
      .then((result) => {
        if (!cancelled) setSummary(result)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof GitlabApiError ? err.message : 'Erro ao buscar os bugs do projeto.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [config])

  return (
    <section className="card">
      <div className="milestone-header">
        <h2>Bugs</h2>
        {summary && <span className="milestone-meta">label "{config.bugLabel}" · {summary.total} no total</span>}
      </div>

      {!config.bugLabel.trim() && (
        <p className="milestone-meta">Configure a label de bug nas Configurações para ver este resumo.</p>
      )}

      {config.bugLabel.trim() && loading && <div className="spinner-row">Carregando bugs…</div>}
      {config.bugLabel.trim() && error && <div className="banner banner-error">{error}</div>}

      {config.bugLabel.trim() && !loading && !error && summary && (
        <>
          <div className="milestone-stats">
            <div className="stat">
              <span className="value">{summary.open}</span>
              <span className="label">Aberto</span>
            </div>
            <div className="stat">
              <span className="value">{summary.inReview}</span>
              <span className="label">Em review</span>
            </div>
            <div className="stat">
              <span className="value">{summary.inTest}</span>
              <span className="label">Em teste</span>
            </div>
            <div className="stat">
              <span className="value">{summary.closed}</span>
              <span className="label">Fechado</span>
            </div>
          </div>
          {config.reviewLabels.length === 0 && config.testLabels.length === 0 && (
            <p className="hint" style={{ display: 'block' }}>
              Nenhuma coluna "em review" ou "em teste" configurada — todo bug aberto cai em
              "Aberto". Configure essas colunas em Configurações para separar por etapa.
            </p>
          )}
        </>
      )}
    </section>
  )
}
