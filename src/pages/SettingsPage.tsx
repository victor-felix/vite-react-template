import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfig } from '../lib/config'
import {
  GitlabApiError,
  createLabel,
  getBoardLists,
  getBoards,
  getProject,
  getProjectLabels,
} from '../lib/gitlabApi'
import { FIBONACCI_LABEL_COLORS, FIBONACCI_SCALE, pointLabelName } from '../lib/points'
import type { GitlabBoard, GitlabBoardList, GitlabLabel } from '../types/gitlab'

export function SettingsPage() {
  const { config, setConfig, resetConfig } = useConfig()
  const navigate = useNavigate()

  const [baseUrl, setBaseUrl] = useState(config?.baseUrl ?? 'https://gitlab.com')
  const [token, setToken] = useState(config?.token ?? '')
  const [projectPath, setProjectPath] = useState(config?.projectPath ?? '')
  const [doneLabels, setDoneLabels] = useState<string[]>(config?.doneLabels ?? [])
  const [doneLabelInput, setDoneLabelInput] = useState('')
  const [inProgressLabels, setInProgressLabels] = useState<string[]>(config?.inProgressLabels ?? [])
  const [inProgressLabelInput, setInProgressLabelInput] = useState('')
  const [excludeLabels, setExcludeLabels] = useState<string[]>(config?.excludeLabels ?? [])
  const [excludeLabelInput, setExcludeLabelInput] = useState('')
  const [pointLabelPrefix, setPointLabelPrefix] = useState(config?.pointLabelPrefix ?? 'point::')
  const [bugLabel, setBugLabel] = useState(config?.bugLabel ?? 'Bug')
  const [reviewLabels, setReviewLabels] = useState<string[]>(config?.reviewLabels ?? [])
  const [reviewLabelInput, setReviewLabelInput] = useState('')
  const [testLabels, setTestLabels] = useState<string[]>(config?.testLabels ?? [])
  const [testLabelInput, setTestLabelInput] = useState('')

  const [loadingBoards, setLoadingBoards] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projectName, setProjectName] = useState<string | null>(null)
  const [boards, setBoards] = useState<GitlabBoard[]>([])
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null)
  const [lists, setLists] = useState<GitlabBoardList[]>([])
  const [allLabels, setAllLabels] = useState<GitlabLabel[]>([])
  const [creatingLabels, setCreatingLabels] = useState(false)
  const [saved, setSaved] = useState(false)

  function addDoneLabel(value: string) {
    const name = value.trim()
    if (!name) return
    setDoneLabels((prev) => (prev.includes(name) ? prev : [...prev, name]))
    setDoneLabelInput('')
  }

  function removeDoneLabel(name: string) {
    setDoneLabels((prev) => prev.filter((l) => l !== name))
  }

  function addInProgressLabel(value: string) {
    const name = value.trim()
    if (!name) return
    setInProgressLabels((prev) => (prev.includes(name) ? prev : [...prev, name]))
    setInProgressLabelInput('')
  }

  function removeInProgressLabel(name: string) {
    setInProgressLabels((prev) => prev.filter((l) => l !== name))
  }

  function addExcludeLabel(value: string) {
    const name = value.trim()
    if (!name) return
    setExcludeLabels((prev) => (prev.includes(name) ? prev : [...prev, name]))
    setExcludeLabelInput('')
  }

  function removeExcludeLabel(name: string) {
    setExcludeLabels((prev) => prev.filter((l) => l !== name))
  }

  function addReviewLabel(value: string) {
    const name = value.trim()
    if (!name) return
    setReviewLabels((prev) => (prev.includes(name) ? prev : [...prev, name]))
    setReviewLabelInput('')
  }

  function removeReviewLabel(name: string) {
    setReviewLabels((prev) => prev.filter((l) => l !== name))
  }

  function addTestLabel(value: string) {
    const name = value.trim()
    if (!name) return
    setTestLabels((prev) => (prev.includes(name) ? prev : [...prev, name]))
    setTestLabelInput('')
  }

  function removeTestLabel(name: string) {
    setTestLabels((prev) => prev.filter((l) => l !== name))
  }

  function currentConfigDraft() {
    return {
      baseUrl,
      token,
      projectPath,
      doneLabels,
      inProgressLabels,
      excludeLabels,
      pointLabelPrefix,
      bugLabel,
      reviewLabels,
      testLabels,
    }
  }

  async function loadBoardLists(boardId: number) {
    const boardLists = await getBoardLists(currentConfigDraft(), boardId)
    setLists(boardLists.filter((l) => l.label))
  }

  async function handleLoadBoards() {
    setError(null)
    setSaved(false)
    if (!baseUrl.trim() || !token.trim() || !projectPath.trim()) {
      setError('Preencha a URL do GitLab, o token e o projeto antes de carregar os quadros.')
      return
    }
    setLoadingBoards(true)
    try {
      const cfg = currentConfigDraft()
      const project = await getProject(cfg)
      setProjectName(project.name_with_namespace)

      const [projectBoards, projectLabels] = await Promise.all([getBoards(cfg), getProjectLabels(cfg)])
      setBoards(projectBoards)
      setAllLabels(projectLabels)
      if (projectBoards.length > 0) {
        setSelectedBoardId(projectBoards[0].id)
        await loadBoardLists(projectBoards[0].id)
      } else {
        setLists([])
      }
    } catch (err) {
      setProjectName(null)
      setBoards([])
      setLists([])
      setAllLabels([])
      setError(err instanceof GitlabApiError ? err.message : 'Erro inesperado ao conectar no GitLab.')
    } finally {
      setLoadingBoards(false)
    }
  }

  async function handleBoardChange(boardId: number) {
    setSelectedBoardId(boardId)
    setError(null)
    try {
      await loadBoardLists(boardId)
    } catch (err) {
      setError(err instanceof GitlabApiError ? err.message : 'Erro ao carregar as colunas do quadro.')
    }
  }

  async function handleCreateMissingPointLabels() {
    setError(null)
    setCreatingLabels(true)
    try {
      const cfg = currentConfigDraft()
      const missing = FIBONACCI_SCALE.filter(
        (value) => !allLabels.some((l) => l.name === pointLabelName(pointLabelPrefix, value)),
      )
      const created = await Promise.all(
        missing.map((value) =>
          createLabel(cfg, pointLabelName(pointLabelPrefix, value), FIBONACCI_LABEL_COLORS[value] ?? '#3987e5'),
        ),
      )
      setAllLabels((prev) => [...prev, ...created])
    } catch (err) {
      setError(err instanceof GitlabApiError ? err.message : 'Erro ao criar as labels de pontuação.')
    } finally {
      setCreatingLabels(false)
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!baseUrl.trim() || !token.trim() || !projectPath.trim() || doneLabels.length === 0) {
      setError('Preencha todos os campos e adicione ao menos uma coluna que representa "finalizado".')
      return
    }
    setConfig({
      baseUrl: baseUrl.trim(),
      token: token.trim(),
      projectPath: projectPath.trim(),
      doneLabels,
      inProgressLabels,
      excludeLabels,
      pointLabelPrefix: pointLabelPrefix.trim(),
      bugLabel: bugLabel.trim(),
      reviewLabels,
      testLabels,
    })
    setSaved(true)
    navigate('/')
  }

  function handleClear() {
    resetConfig()
    setBaseUrl('https://gitlab.com')
    setToken('')
    setProjectPath('')
    setDoneLabels([])
    setDoneLabelInput('')
    setInProgressLabels([])
    setInProgressLabelInput('')
    setExcludeLabels([])
    setExcludeLabelInput('')
    setPointLabelPrefix('point::')
    setBugLabel('Bug')
    setReviewLabels([])
    setReviewLabelInput('')
    setTestLabels([])
    setTestLabelInput('')
    setProjectName(null)
    setBoards([])
    setLists([])
    setAllLabels([])
    setSaved(false)
  }

  const missingPointLabels = FIBONACCI_SCALE.filter(
    (value) => !allLabels.some((l) => l.name === pointLabelName(pointLabelPrefix, value)),
  )

  return (
    <>
      <div className="page-header">
        <h1>Configurações</h1>
        <p>
          Informe os dados do seu projeto GitLab. Essas informações ficam salvas apenas na sessão
          deste navegador (não são enviadas a nenhum servidor além do GitLab).
        </p>
      </div>

      {error && <div className="banner banner-error">{error}</div>}
      {saved && !error && <div className="banner banner-success">Configurações salvas.</div>}
      {projectName && !error && (
        <div className="banner banner-success">Conectado ao projeto "{projectName}".</div>
      )}

      <form className="card" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="baseUrl">URL da instância do GitLab</label>
          <input
            id="baseUrl"
            type="url"
            placeholder="https://gitlab.com"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            required
          />
        </div>

        <div className="form-field">
          <label htmlFor="token">Token de API (Personal Access Token)</label>
          <input
            id="token"
            type="password"
            placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoComplete="off"
            required
          />
          <span className="hint">
            Precisa do escopo "api" (não só "read_api") se você quiser usar o botão de criar labels
            de pontuação abaixo. Só leitura funciona com "read_api".
          </span>
        </div>

        <div className="form-field">
          <label htmlFor="projectPath">Projeto (caminho ou ID)</label>
          <input
            id="projectPath"
            type="text"
            placeholder="grupo/subgrupo/projeto ou 12345678"
            value={projectPath}
            onChange={(e) => setProjectPath(e.target.value)}
            required
          />
        </div>

        <div className="actions-row" style={{ marginTop: 0, marginBottom: '1.1rem' }}>
          <button type="button" className="btn" onClick={handleLoadBoards} disabled={loadingBoards}>
            {loadingBoards ? 'Carregando...' : 'Carregar quadros e labels do projeto'}
          </button>
        </div>

        {boards.length > 1 && (
          <div className="form-field">
            <label htmlFor="board">Quadro (board)</label>
            <select
              id="board"
              value={selectedBoardId ?? ''}
              onChange={(e) => handleBoardChange(Number(e.target.value))}
            >
              {boards.map((board) => (
                <option key={board.id} value={board.id}>
                  {board.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="form-field">
          <label htmlFor="doneLabel">Colunas que representam "finalizado"</label>

          {doneLabels.length > 0 && (
            <div className="tag-list">
              {doneLabels.map((name) => (
                <span key={name} className="tag">
                  {name}
                  <button
                    type="button"
                    className="tag-remove"
                    aria-label={`Remover coluna ${name}`}
                    onClick={() => removeDoneLabel(name)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="form-row">
            <input
              id="doneLabel"
              type="text"
              list="done-columns"
              placeholder="Done"
              value={doneLabelInput}
              onChange={(e) => setDoneLabelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addDoneLabel(doneLabelInput)
                }
              }}
            />
            <button
              type="button"
              className="btn"
              style={{ flex: '0 0 auto' }}
              onClick={() => addDoneLabel(doneLabelInput)}
            >
              Adicionar
            </button>
          </div>
          <datalist id="done-columns">
            {lists
              .filter((l) => l.label && !doneLabels.includes(l.label.name))
              .map((list) => (
                <option key={list.id} value={list.label?.name ?? ''} />
              ))}
          </datalist>

          {lists.length > 0 && (
            <div className="tag-list">
              {lists
                .filter((l) => l.label && !doneLabels.includes(l.label.name))
                .map((list) => (
                  <button
                    key={list.id}
                    type="button"
                    className="tag tag-suggestion"
                    onClick={() => addDoneLabel(list.label?.name ?? '')}
                  >
                    + {list.label?.name}
                  </button>
                ))}
            </div>
          )}

          <span className="hint">
            {lists.length > 0
              ? 'Clique nas colunas do quadro para adicioná-las, ou digite manualmente. Uma tarefa é considerada finalizada ao entrar em qualquer uma das colunas selecionadas.'
              : 'Digite o nome exato de cada label/coluna que indica conclusão. Carregue os quadros acima para ver sugestões.'}
          </span>
        </div>

        <div className="form-field">
          <label htmlFor="inProgressLabel">Colunas que representam "em andamento"</label>

          {inProgressLabels.length > 0 && (
            <div className="tag-list">
              {inProgressLabels.map((name) => (
                <span key={name} className="tag">
                  {name}
                  <button
                    type="button"
                    className="tag-remove"
                    aria-label={`Remover coluna ${name}`}
                    onClick={() => removeInProgressLabel(name)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="form-row">
            <input
              id="inProgressLabel"
              type="text"
              list="in-progress-columns"
              placeholder="Doing"
              value={inProgressLabelInput}
              onChange={(e) => setInProgressLabelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addInProgressLabel(inProgressLabelInput)
                }
              }}
            />
            <button
              type="button"
              className="btn"
              style={{ flex: '0 0 auto' }}
              onClick={() => addInProgressLabel(inProgressLabelInput)}
            >
              Adicionar
            </button>
          </div>
          <datalist id="in-progress-columns">
            {lists
              .filter((l) => l.label && !inProgressLabels.includes(l.label.name))
              .map((list) => (
                <option key={list.id} value={list.label?.name ?? ''} />
              ))}
          </datalist>

          {lists.length > 0 && (
            <div className="tag-list">
              {lists
                .filter((l) => l.label && !inProgressLabels.includes(l.label.name))
                .map((list) => (
                  <button
                    key={list.id}
                    type="button"
                    className="tag tag-suggestion"
                    onClick={() => addInProgressLabel(list.label?.name ?? '')}
                  >
                    + {list.label?.name}
                  </button>
                ))}
            </div>
          )}

          <span className="hint">
            Usado só no gráfico de Gantt: a barra de cada tarefa começa quando ela entra em
            qualquer uma dessas colunas (em vez da data de criação, que costuma ser bem anterior
            ao início do trabalho de fato). Opcional — sem isso, a barra começa na data de início
            da milestone.
          </span>
        </div>

        <div className="form-field">
          <label htmlFor="excludeLabel">Ignorar tarefas com estas labels</label>

          {excludeLabels.length > 0 && (
            <div className="tag-list">
              {excludeLabels.map((name) => (
                <span key={name} className="tag">
                  {name}
                  <button
                    type="button"
                    className="tag-remove"
                    aria-label={`Remover exclusão ${name}`}
                    onClick={() => removeExcludeLabel(name)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="form-row">
            <input
              id="excludeLabel"
              type="text"
              list="all-labels"
              placeholder="Epic"
              value={excludeLabelInput}
              onChange={(e) => setExcludeLabelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addExcludeLabel(excludeLabelInput)
                }
              }}
            />
            <button
              type="button"
              className="btn"
              style={{ flex: '0 0 auto' }}
              onClick={() => addExcludeLabel(excludeLabelInput)}
            >
              Adicionar
            </button>
          </div>
          <datalist id="all-labels">
            {allLabels
              .filter((l) => !excludeLabels.includes(l.name))
              .map((l) => (
                <option key={l.id} value={l.name} />
              ))}
          </datalist>

          <span className="hint">
            Tarefas com qualquer uma dessas labels (ex.: "Epic") não entram nos gráficos de
            burndown nem nos indicadores de pontuação.
          </span>
        </div>

        <div className="form-field">
          <label htmlFor="pointLabelPrefix">Prefixo da label de pontuação</label>
          <input
            id="pointLabelPrefix"
            type="text"
            placeholder="point::"
            value={pointLabelPrefix}
            onChange={(e) => setPointLabelPrefix(e.target.value)}
          />
          <span className="hint">
            Tarefas com uma label "{pointLabelPrefix || 'point::'}N" (ex.: "{pointLabelPrefix || 'point::'}
            3") contam N pontos no burndown por pontuação. Deixe em branco para desativar e usar
            contagem de tarefas.
          </span>
        </div>

        {pointLabelPrefix.trim() && (
          <div className="form-field">
            <label>Labels de pontuação recomendadas (escala Fibonacci)</label>
            <div className="point-scale-list">
              {FIBONACCI_SCALE.map((value) => {
                const name = pointLabelName(pointLabelPrefix, value)
                const exists = allLabels.some((l) => l.name === name)
                return (
                  <span key={value} className={`point-scale-chip${exists ? ' point-scale-chip--ok' : ''}`}>
                    <span
                      className="point-scale-swatch"
                      style={{ background: FIBONACCI_LABEL_COLORS[value] ?? 'var(--series-actual)' }}
                    />
                    {name}
                    <span className="point-scale-status">{exists ? '✓' : '—'}</span>
                  </span>
                )
              })}
            </div>
            <span className="hint">
              {allLabels.length === 0
                ? 'Carregue os quadros e labels do projeto acima para ver quais já existem.'
                : missingPointLabels.length === 0
                  ? 'Todas as labels da escala já existem no projeto.'
                  : `Faltam ${missingPointLabels.length} label(s). Essas labels usam a sintaxe de "scoped labels" do GitLab (prefixo::valor), então cada tarefa só recebe uma pontuação por vez.`}
            </span>
            {allLabels.length > 0 && missingPointLabels.length > 0 && (
              <div className="actions-row" style={{ marginTop: '0.6rem' }}>
                <button
                  type="button"
                  className="btn"
                  onClick={handleCreateMissingPointLabels}
                  disabled={creatingLabels}
                >
                  {creatingLabels ? 'Criando...' : `Criar ${missingPointLabels.length} label(s) que faltam`}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="form-field">
          <label htmlFor="bugLabel">Label que identifica bugs</label>
          <input
            id="bugLabel"
            type="text"
            list="all-labels"
            placeholder="Bug"
            value={bugLabel}
            onChange={(e) => setBugLabel(e.target.value)}
          />
          <span className="hint">
            Usada no resumo de bugs do relatório. Deixe em branco para esconder esse resumo.
          </span>
        </div>

        <div className="form-field">
          <label htmlFor="reviewLabel">Colunas que representam "em review"</label>

          {reviewLabels.length > 0 && (
            <div className="tag-list">
              {reviewLabels.map((name) => (
                <span key={name} className="tag">
                  {name}
                  <button
                    type="button"
                    className="tag-remove"
                    aria-label={`Remover coluna ${name}`}
                    onClick={() => removeReviewLabel(name)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="form-row">
            <input
              id="reviewLabel"
              type="text"
              list="review-columns"
              placeholder="Review"
              value={reviewLabelInput}
              onChange={(e) => setReviewLabelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addReviewLabel(reviewLabelInput)
                }
              }}
            />
            <button
              type="button"
              className="btn"
              style={{ flex: '0 0 auto' }}
              onClick={() => addReviewLabel(reviewLabelInput)}
            >
              Adicionar
            </button>
          </div>
          <datalist id="review-columns">
            {lists
              .filter((l) => l.label && !reviewLabels.includes(l.label.name))
              .map((list) => (
                <option key={list.id} value={list.label?.name ?? ''} />
              ))}
          </datalist>

          {lists.length > 0 && (
            <div className="tag-list">
              {lists
                .filter((l) => l.label && !reviewLabels.includes(l.label.name))
                .map((list) => (
                  <button
                    key={list.id}
                    type="button"
                    className="tag tag-suggestion"
                    onClick={() => addReviewLabel(list.label?.name ?? '')}
                  >
                    + {list.label?.name}
                  </button>
                ))}
            </div>
          )}

          <span className="hint">Usado no resumo de bugs, para contar quantos estão em review.</span>
        </div>

        <div className="form-field">
          <label htmlFor="testLabel">Colunas que representam "em teste"</label>

          {testLabels.length > 0 && (
            <div className="tag-list">
              {testLabels.map((name) => (
                <span key={name} className="tag">
                  {name}
                  <button
                    type="button"
                    className="tag-remove"
                    aria-label={`Remover coluna ${name}`}
                    onClick={() => removeTestLabel(name)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}

          <div className="form-row">
            <input
              id="testLabel"
              type="text"
              list="test-columns"
              placeholder="QA"
              value={testLabelInput}
              onChange={(e) => setTestLabelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addTestLabel(testLabelInput)
                }
              }}
            />
            <button
              type="button"
              className="btn"
              style={{ flex: '0 0 auto' }}
              onClick={() => addTestLabel(testLabelInput)}
            >
              Adicionar
            </button>
          </div>
          <datalist id="test-columns">
            {lists
              .filter((l) => l.label && !testLabels.includes(l.label.name))
              .map((list) => (
                <option key={list.id} value={list.label?.name ?? ''} />
              ))}
          </datalist>

          {lists.length > 0 && (
            <div className="tag-list">
              {lists
                .filter((l) => l.label && !testLabels.includes(l.label.name))
                .map((list) => (
                  <button
                    key={list.id}
                    type="button"
                    className="tag tag-suggestion"
                    onClick={() => addTestLabel(list.label?.name ?? '')}
                  >
                    + {list.label?.name}
                  </button>
                ))}
            </div>
          )}

          <span className="hint">Usado no resumo de bugs, para contar quantos estão em teste.</span>
        </div>

        <div className="actions-row">
          <button type="submit" className="btn btn-primary">
            Salvar configurações
          </button>
          {config && (
            <button type="button" className="btn btn-ghost" onClick={handleClear}>
              Limpar configurações
            </button>
          )}
        </div>
      </form>
    </>
  )
}
