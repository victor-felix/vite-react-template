import type {
  GitlabBoard,
  GitlabBoardList,
  GitlabConfig,
  GitlabIssue,
  GitlabMilestone,
  GitlabProject,
  GitlabResourceLabelEvent,
} from '../types/gitlab'

export class GitlabApiError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'GitlabApiError'
    this.status = status
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, '')
}

async function gitlabFetch<T>(
  config: Pick<GitlabConfig, 'baseUrl' | 'token'>,
  path: string,
  params: Record<string, string | number | undefined> = {},
): Promise<T> {
  const url = new URL(`${normalizeBaseUrl(config.baseUrl)}/api/v4${path}`)
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value))
  }

  let response: Response
  try {
    response = await fetch(url.toString(), {
      headers: { 'PRIVATE-TOKEN': config.token },
    })
  } catch {
    throw new GitlabApiError(
      `Não foi possível conectar em ${config.baseUrl}. Verifique a URL e sua conexão (CORS pode bloquear instâncias que não permitem chamadas do navegador).`,
    )
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new GitlabApiError('Token de API inválido ou sem permissão.', 401)
    }
    if (response.status === 404) {
      throw new GitlabApiError('Projeto não encontrado. Verifique a URL/ID do projeto.', 404)
    }
    throw new GitlabApiError(`Erro ${response.status} ao chamar a API do GitLab.`, response.status)
  }

  return response.json() as Promise<T>
}

function projectIdParam(projectPath: string): string {
  return encodeURIComponent(projectPath.trim())
}

export function getProject(config: GitlabConfig): Promise<GitlabProject> {
  return gitlabFetch<GitlabProject>(config, `/projects/${projectIdParam(config.projectPath)}`)
}

export function getActiveMilestones(config: GitlabConfig): Promise<GitlabMilestone[]> {
  return gitlabFetch<GitlabMilestone[]>(
    config,
    `/projects/${projectIdParam(config.projectPath)}/milestones`,
    { state: 'active', per_page: 100 },
  )
}

export function getMilestoneIssues(
  config: GitlabConfig,
  milestoneId: number,
): Promise<GitlabIssue[]> {
  return gitlabFetch<GitlabIssue[]>(
    config,
    `/projects/${projectIdParam(config.projectPath)}/milestones/${milestoneId}/issues`,
    { per_page: 100 },
  )
}

export function getIssueResourceLabelEvents(
  config: GitlabConfig,
  issueIid: number,
): Promise<GitlabResourceLabelEvent[]> {
  return gitlabFetch<GitlabResourceLabelEvent[]>(
    config,
    `/projects/${projectIdParam(config.projectPath)}/issues/${issueIid}/resource_label_events`,
    { per_page: 100 },
  )
}

export function getBoards(config: GitlabConfig): Promise<GitlabBoard[]> {
  return gitlabFetch<GitlabBoard[]>(
    config,
    `/projects/${projectIdParam(config.projectPath)}/boards`,
    { per_page: 100 },
  )
}

export function getBoardLists(
  config: GitlabConfig,
  boardId: number,
): Promise<GitlabBoardList[]> {
  return gitlabFetch<GitlabBoardList[]>(
    config,
    `/projects/${projectIdParam(config.projectPath)}/boards/${boardId}/lists`,
    { per_page: 100 },
  )
}
