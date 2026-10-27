import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useConfig } from '../lib/config'
import { loadUserStories, type StorySection, type UserStoriesResult } from '../lib/userStories'
import { UserStoryAccordion } from '../components/UserStoryAccordion'

function StoryList({ section, emptyMessage }: { section: StorySection; emptyMessage: string }) {
  if (section.error) return <div className="banner banner-error">{section.error}</div>
  if (!section.stories || section.stories.length === 0) {
    return (
      <div className="empty-state card">
        <p>{emptyMessage}</p>
      </div>
    )
  }
  return (
    <div className="story-list">
      {section.stories.map((story) => (
        <UserStoryAccordion key={story.key} story={story} />
      ))}
    </div>
  )
}

export function UserStoriesPage() {
  const { config } = useConfig()
  const [result, setResult] = useState<UserStoriesResult | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!config) return
    let cancelled = false
    setLoading(true)
    setResult(null)
    loadUserStories(config)
      .then((loaded) => {
        if (!cancelled) setResult(loaded)
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
        <p>Configure a URL do GitLab, o token de acesso e o projeto para ver as histórias.</p>
        <Link to="/settings" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Ir para configurações
        </Link>
      </div>
    )
  }

  const gitlabStories = result?.gitlab.stories
  const openCount = gitlabStories?.filter((s) => s.status === 'opened').length ?? 0
  const closedCount = (gitlabStories?.length ?? 0) - openCount

  return (
    <>
      <div className="page-header">
        <h1>Histórias de usuário</h1>
        <p>
          Desenvolvimento medido pelas subtasks com a label "{config.taskLabel}" e o código da
          história entre colchetes no título (ex.: "[US007] - …"). Uma subtask conta como concluída
          quando está fechada ou em uma das colunas "{config.doneLabels.join('", "')}".
        </p>
      </div>

      {!config.taskLabel.trim() && (
        <div className="banner banner-error">
          Nenhuma label de subtask configurada — todas as histórias aparecem sem subtasks. Configure-a
          em Configurações.
        </div>
      )}

      {loading && <div className="spinner-row">Carregando histórias…</div>}

      {!loading && result && (
        <>
          <div className="page-header">
            <h2>Histórias no GitLab</h2>
            <p>
              Issues com a label "{config.storyLabel}"
              {gitlabStories && ` · ${openCount} aberta(s), ${closedCount} fechada(s)`}
            </p>
          </div>

          {config.storyLabel.trim() ? (
            <StoryList section={result.gitlab} emptyMessage={`Nenhuma issue com a label "${config.storyLabel}".`} />
          ) : (
            <p className="milestone-meta">
              Configure a label das histórias em Configurações para listar as histórias do GitLab.
            </p>
          )}

          <div className="page-header" style={{ marginTop: '2rem' }}>
            <h2>Em validação (wiki)</h2>
            <p>
              {result.wiki
                ? `Páginas em "${config.validationWikiPath}"${result.wiki.stories ? ` · ${result.wiki.stories.length} história(s)` : ''}`
                : 'Histórias escritas na wiki que ainda aguardam validação do negócio.'}
            </p>
          </div>

          {result.wiki ? (
            <StoryList section={result.wiki} emptyMessage="Nenhuma página encontrada dentro desta pasta da wiki." />
          ) : (
            <p className="milestone-meta">
              Informe em Configurações a pasta da wiki com as histórias em validação para listá-las aqui.
            </p>
          )}
        </>
      )}
    </>
  )
}
