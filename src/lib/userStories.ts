import { GitlabApiError, getAllIssuesByLabel, getProject, getWikiPages } from './gitlabApi'
import { filterExcludedIssues } from './points'
import type { GitlabConfig, GitlabIssue, GitlabWikiPage } from '../types/gitlab'

export interface StoryTask {
  issue: GitlabIssue
  done: boolean
}

export interface StoryProgress {
  done: number
  total: number
  // null quando a história não tem subtasks — exibido como "Sem subtasks", não 0%.
  percent: number | null
}

export type StoryStatus = 'opened' | 'closed' | 'validation'

export interface UserStory {
  key: string
  code: string | null
  title: string
  status: StoryStatus
  webUrl: string
  tasks: StoryTask[]
  progress: StoryProgress
}

export interface StorySection {
  stories: UserStory[] | null
  error: string | null
}

export interface UserStoriesResult {
  gitlab: StorySection
  // null quando nenhuma pasta da wiki está configurada.
  wiki: StorySection | null
}

// Código no início do título da história, com ou sem colchetes:
// "US007 - …", "US004B - …", "HU01 - …", "[E-002] - …".
const STORY_CODE = /^\s*\[?([A-Za-z]{1,4}-?\d+[A-Za-z]?)\]?/
// Código da subtask: o primeiro par de colchetes, "[US007] - …".
const TASK_CODE = /^\s*\[([^\]]+)\]/
const LEADING_SEPARATOR = /^[\s\-–—:]+/

function normalizeCode(code: string): string {
  return code.trim().toUpperCase()
}

export function parseStoryCode(title: string): string | null {
  const match = title.match(STORY_CODE)
  return match ? normalizeCode(match[1]) : null
}

export function parseTaskCode(title: string): string | null {
  const match = title.match(TASK_CODE)
  return match ? normalizeCode(match[1]) : null
}

function stripStoryCode(title: string): string {
  return title.replace(STORY_CODE, '').replace(LEADING_SEPARATOR, '').trim()
}

export function stripTaskCode(title: string): string {
  return title.replace(TASK_CODE, '').replace(LEADING_SEPARATOR, '').trim()
}

export function isTaskDone(issue: GitlabIssue, doneLabels: string[]): boolean {
  return issue.state === 'closed' || issue.labels.some((l) => doneLabels.includes(l))
}

export function storyProgress(tasks: StoryTask[]): StoryProgress {
  const done = tasks.filter((t) => t.done).length
  const total = tasks.length
  return { done, total, percent: total === 0 ? null : Math.round((done / total) * 100) }
}

function toStoryTasks(issues: GitlabIssue[], doneLabels: string[]): StoryTask[] {
  return [...issues]
    .sort((a, b) => a.iid - b.iid)
    .map((issue) => ({ issue, done: isTaskDone(issue, doneLabels) }))
}

function groupTasksByCode(tasks: GitlabIssue[]): Map<string, GitlabIssue[]> {
  const byCode = new Map<string, GitlabIssue[]>()
  for (const task of tasks) {
    const code = parseTaskCode(task.title)
    if (!code) continue
    byCode.set(code, [...(byCode.get(code) ?? []), task])
  }
  return byCode
}

function compareCodes(a: string | null, b: string | null): number {
  if (a === b) return 0
  if (a === null) return 1
  if (b === null) return -1
  return a.localeCompare(b, 'pt-BR', { numeric: true })
}

// Quando mais de uma história tem o mesmo código (ex.: US007 em #124 e #545),
// a subtask vai para a que a descrição dela cita ("Issue-mãe: #545"); sem
// citação, para a de maior iid.
function pickStory(task: GitlabIssue, candidates: GitlabIssue[]): GitlabIssue {
  if (candidates.length === 1) return candidates[0]
  const referenced = new Set(
    [...(task.description ?? '').matchAll(/#(\d+)\b/g)].map((m) => Number(m[1])),
  )
  const cited = candidates.filter((story) => referenced.has(story.iid))
  const pool = cited.length > 0 ? cited : candidates
  return pool.reduce((best, story) => (story.iid > best.iid ? story : best))
}

export function buildGitlabStories(
  storyIssues: GitlabIssue[],
  taskIssues: GitlabIssue[],
  config: GitlabConfig,
): UserStory[] {
  const storyIids = new Set(storyIssues.map((s) => s.iid))
  const tasks = filterExcludedIssues(taskIssues, config.excludeLabels).filter((t) => !storyIids.has(t.iid))

  const storiesByCode = new Map<string, GitlabIssue[]>()
  for (const story of storyIssues) {
    const code = parseStoryCode(story.title)
    if (!code) continue
    storiesByCode.set(code, [...(storiesByCode.get(code) ?? []), story])
  }

  const tasksByStory = new Map<number, GitlabIssue[]>()
  for (const task of tasks) {
    const code = parseTaskCode(task.title)
    const candidates = code ? storiesByCode.get(code) : undefined
    if (!candidates) continue
    const story = pickStory(task, candidates)
    tasksByStory.set(story.iid, [...(tasksByStory.get(story.iid) ?? []), task])
  }

  return [...storyIssues]
    .sort((a, b) => {
      if (a.state !== b.state) return a.state === 'opened' ? -1 : 1
      return compareCodes(parseStoryCode(a.title), parseStoryCode(b.title)) || a.iid - b.iid
    })
    .map((issue): UserStory => {
      const storyTasks = toStoryTasks(tasksByStory.get(issue.iid) ?? [], config.doneLabels)
      return {
        key: `issue-${issue.iid}`,
        code: parseStoryCode(issue.title),
        title: stripStoryCode(issue.title) || issue.title,
        status: issue.state,
        webUrl: issue.web_url,
        tasks: storyTasks,
        progress: storyProgress(storyTasks),
      }
    })
}

// Aceita o caminho da página ("Documentação-Negocial/…/Validação") ou a URL
// copiada do navegador (".../-/wikis/Documenta%C3%A7%C3%A3o-Negocial/…").
export function normalizeWikiPath(value: string): string {
  let path = value.trim()
  const marker = path.indexOf('/-/wikis/')
  if (marker !== -1) path = path.slice(marker + '/-/wikis/'.length).split(/[?#]/)[0]
  try {
    path = decodeURIComponent(path)
  } catch {
    // Sequência % inválida: mantém o texto como foi digitado.
  }
  return path.replace(/^\/+|\/+$/g, '')
}

// Na listagem, o GitLab troca os hífens do slug por espaços: " - " vira três
// espaços ("US010   Migração de Acesso").
function wikiDisplayTitle(title: string): string {
  return stripStoryCode(title).replace(/\s{3,}/g, ' – ').replace(/\s{2,}/g, ' ')
}

export function buildWikiStories(
  pages: GitlabWikiPage[],
  taskIssues: GitlabIssue[],
  folder: string,
  projectWebUrl: string,
  config: GitlabConfig,
): UserStory[] {
  const prefix = `${folder}/`
  const tasksByCode = groupTasksByCode(filterExcludedIssues(taskIssues, config.excludeLabels))

  return pages
    .filter((page) => page.slug.startsWith(prefix))
    .map((page): UserStory => {
      const code = parseStoryCode(page.title)
      const storyTasks = toStoryTasks((code && tasksByCode.get(code)) || [], config.doneLabels)
      return {
        key: `wiki-${page.slug}`,
        code,
        title: wikiDisplayTitle(page.title) || page.title,
        status: 'validation',
        webUrl: `${projectWebUrl}/-/wikis/${page.slug.split('/').map(encodeURIComponent).join('/')}`,
        tasks: storyTasks,
        progress: storyProgress(storyTasks),
      }
    })
    .sort((a, b) => compareCodes(a.code, b.code) || a.key.localeCompare(b.key, 'pt-BR'))
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof GitlabApiError ? err.message : fallback
}

// Busca histórias, subtasks, wiki e projeto em paralelo. Nunca rejeita: o
// erro de cada seção vem no próprio resultado, para que uma falha na wiki
// não esconda as histórias do GitLab (e vice-versa).
export async function loadUserStories(config: GitlabConfig): Promise<UserStoriesResult> {
  const folder = normalizeWikiPath(config.validationWikiPath)

  const [tasksResult, storiesResult, pagesResult, projectResult] = await Promise.allSettled([
    config.taskLabel.trim() ? getAllIssuesByLabel(config, config.taskLabel) : Promise.resolve([]),
    config.storyLabel.trim() ? getAllIssuesByLabel(config, config.storyLabel) : Promise.resolve([]),
    folder ? getWikiPages(config) : Promise.resolve([]),
    folder ? getProject(config) : Promise.resolve(null),
  ])

  const tasksError =
    tasksResult.status === 'rejected' ? errorMessage(tasksResult.reason, 'Erro ao buscar as subtasks.') : null

  let gitlab: StorySection
  if (storiesResult.status === 'rejected') {
    gitlab = { stories: null, error: errorMessage(storiesResult.reason, 'Erro ao buscar as histórias.') }
  } else if (tasksResult.status === 'rejected') {
    gitlab = { stories: null, error: tasksError }
  } else {
    gitlab = { stories: buildGitlabStories(storiesResult.value, tasksResult.value, config), error: null }
  }

  let wiki: StorySection | null = null
  if (folder) {
    if (pagesResult.status === 'rejected') {
      const reason = pagesResult.reason
      wiki = {
        stories: null,
        error:
          reason instanceof GitlabApiError && reason.status === 404
            ? 'Wiki não encontrada. Verifique se a wiki está habilitada no projeto e se o token tem acesso a ela.'
            : errorMessage(reason, 'Erro ao buscar as páginas da wiki.'),
      }
    } else if (projectResult.status === 'rejected') {
      wiki = { stories: null, error: errorMessage(projectResult.reason, 'Erro ao buscar o projeto.') }
    } else if (tasksResult.status === 'rejected') {
      wiki = { stories: null, error: tasksError }
    } else {
      wiki = {
        stories: buildWikiStories(
          pagesResult.value,
          tasksResult.value,
          folder,
          projectResult.value?.web_url ?? '',
          config,
        ),
        error: null,
      }
    }
  }

  return { gitlab, wiki }
}
