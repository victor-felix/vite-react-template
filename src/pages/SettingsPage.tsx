import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useConfig } from '../lib/config'
import { GitlabApiError, getBoardLists, getBoards, getProject } from '../lib/gitlabApi'
import type { GitlabBoard, GitlabBoardList } from '../types/gitlab'

export function SettingsPage() {
  const { config, setConfig, resetConfig } = useConfig()
  const navigate = useNavigate()

  const [baseUrl, setBaseUrl] = useState(config?.baseUrl ?? 'https://gitlab.com')
  const [token, setToken] = useState(config?.token ?? '')
  const [projectPath, setProjectPath] = useState(config?.projectPath ?? '')
  const [doneLabel, setDoneLabel] = useState(config?.doneLabel ?? '')

  const [loadingBoards, setLoadingBoards] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projectName, setProjectName] = useState<string | null>(null)
  const [boards, setBoards] = useState<GitlabBoard[]>([])
  const [selectedBoardId, setSelectedBoardId] = useState<number | null>(null)
  const [lists, setLists] = useState<GitlabBoardList[]>([])
  const [saved, setSaved] = useState(false)

  async function loadBoardLists(boardId: number) {
    const boardLists = await getBoardLists({ baseUrl, token, projectPath, doneLabel }, boardId)
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
      const cfg = { baseUrl, token, projectPath, doneLabel }
      const project = await getProject(cfg)
      setProjectName(project.name_with_namespace)
      const projectBoards = await getBoards(cfg)
      setBoards(projectBoards)
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!baseUrl.trim() || !token.trim() || !projectPath.trim() || !doneLabel.trim()) {
      setError('Preencha todos os campos, incluindo a coluna que representa "finalizado".')
      return
    }
    setConfig({
      baseUrl: baseUrl.trim(),
      token: token.trim(),
      projectPath: projectPath.trim(),
      doneLabel: doneLabel.trim(),
    })
    setSaved(true)
    navigate('/')
  }

  function handleClear() {
    resetConfig()
    setBaseUrl('https://gitlab.com')
    setToken('')
    setProjectPath('')
    setDoneLabel('')
    setProjectName(null)
    setBoards([])
    setLists([])
    setSaved(false)
  }

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
          <span className="hint">Precisa do escopo "read_api" (ou "api").</span>
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
            {loadingBoards ? 'Carregando...' : 'Carregar quadros do projeto'}
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
          <label htmlFor="doneLabel">Coluna que representa "finalizado"</label>
          <input
            id="doneLabel"
            type="text"
            list="done-columns"
            placeholder="Done"
            value={doneLabel}
            onChange={(e) => setDoneLabel(e.target.value)}
            required
          />
          <datalist id="done-columns">
            {lists.map((list) => (
              <option key={list.id} value={list.label?.name ?? ''} />
            ))}
          </datalist>
          <span className="hint">
            {lists.length > 0
              ? 'Selecione (ou digite) a coluna do quadro que indica que a tarefa foi concluída. O burndown considera as tarefas que entraram nessa coluna.'
              : 'Digite o nome exato da label/coluna do quadro que indica conclusão. Carregue os quadros acima para ver sugestões.'}
          </span>
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
