import { useEffect, useState } from 'react'
import { GitlabApiError, getOpenMergeRequests } from '../lib/gitlabApi'
import type { GitlabConfig, GitlabMergeRequest } from '../types/gitlab'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function OpenMergeRequests({ config }: { config: GitlabConfig }) {
  const [mergeRequests, setMergeRequests] = useState<GitlabMergeRequest[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    getOpenMergeRequests(config)
      .then((result) => {
        if (!cancelled) setMergeRequests(result)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof GitlabApiError ? err.message : 'Erro ao buscar merge requests.')
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
        <h2>Merge requests abertos</h2>
        {mergeRequests && <span className="milestone-meta">{mergeRequests.length}</span>}
      </div>

      {loading && <div className="spinner-row">Carregando merge requests…</div>}
      {error && <div className="banner banner-error">{error}</div>}

      {!loading && !error && mergeRequests && mergeRequests.length === 0 && (
        <p className="milestone-meta">Nenhum merge request aberto neste projeto.</p>
      )}

      {!loading && !error && mergeRequests && mergeRequests.length > 0 && (
        <ul className="mr-list">
          {mergeRequests.map((mr) => (
            <li key={mr.id} className="mr-item">
              <div className="mr-item__main">
                <a href={mr.web_url} target="_blank" rel="noreferrer">
                  !{mr.iid} {mr.title}
                </a>
                {mr.draft && <span className="tag mr-item__badge">Rascunho</span>}
              </div>
              <div className="mr-item__meta">
                {mr.author.name} · {mr.source_branch} → {mr.target_branch} · atualizado em{' '}
                {formatDate(mr.updated_at)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
