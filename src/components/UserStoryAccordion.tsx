import { stripTaskCode, type StoryStatus, type UserStory } from '../lib/userStories'

const STATUS_LABEL: Record<StoryStatus, string> = {
  opened: 'Aberta',
  closed: 'Fechada',
  validation: 'Em validação',
}

export function UserStoryAccordion({ story }: { story: UserStory }) {
  const { done, total, percent } = story.progress

  return (
    <details className="story">
      <summary className="story__summary">
        <span className="story__chevron" aria-hidden="true" />
        <div className="story__heading">
          <span className="story__title">
            {story.code && <span className="story__code">{story.code}</span>}
            {story.title}
          </span>
          <span className="story__meta">
            <span className={`tag story__badge story__badge--${story.status}`}>{STATUS_LABEL[story.status]}</span>
            {percent === null ? (
              <span>Sem subtasks</span>
            ) : (
              <span>
                {done}/{total} · <span className="story__percent">{percent}%</span>
              </span>
            )}
          </span>
        </div>
        <div className="progress-track story__progress" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${percent ?? 0}%` }} />
        </div>
      </summary>

      <div className="story__body">
        <a href={story.webUrl} target="_blank" rel="noreferrer" className="story__link">
          {story.status === 'validation' ? 'Abrir página na wiki' : 'Abrir história no GitLab'}
        </a>

        {story.tasks.length === 0 ? (
          <p className="milestone-meta">
            {story.code
              ? `Nenhuma subtask com o prefixo [${story.code}] no título.`
              : 'Não foi possível identificar o código desta história no título, então nenhuma subtask foi vinculada.'}
          </p>
        ) : (
          <ul className="story-tasks">
            {story.tasks.map(({ issue, done: taskDone }) => (
              <li key={issue.id} className={`story-task story-task--${taskDone ? 'done' : 'pending'}`}>
                <span className="story-task__status">
                  <span aria-hidden="true">{taskDone ? '✓' : '○'}</span>
                  {taskDone ? 'Concluída' : 'Pendente'}
                </span>
                <a href={issue.web_url} target="_blank" rel="noreferrer">
                  #{issue.iid} {stripTaskCode(issue.title) || issue.title}
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  )
}
