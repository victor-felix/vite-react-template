import { getIssueResourceLabelEvents, getMilestoneIssues } from './gitlabApi'
import { filterExcludedIssues, getIssuePoints } from './points'
import type { GitlabConfig, GitlabIssue, GitlabMilestone } from '../types/gitlab'

export interface BurndownPoint {
  date: string
  idealIssues: number | null
  actualIssues: number | null
  idealPoints: number | null
  actualPoints: number | null
}

export interface MilestoneBurndown {
  milestone: GitlabMilestone
  totalIssues: number
  completedIssues: number
  totalPoints: number
  completedPoints: number
  issuesWithoutPoints: number
  hasPoints: boolean
  points: BurndownPoint[]
  hasDueDate: boolean
}

const MAX_DAYS = 730

function toDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function parseDateOnly(iso: string): Date {
  return toDateOnly(new Date(iso))
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setUTCDate(r.getUTCDate() + days)
  return r
}

function formatDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function isMilestoneInProgress(milestone: GitlabMilestone, referenceDate = new Date()): boolean {
  if (milestone.state !== 'active') return false
  const today = toDateOnly(referenceDate)
  if (milestone.start_date && parseDateOnly(milestone.start_date).getTime() > today.getTime()) {
    return false
  }
  if (milestone.due_date && parseDateOnly(milestone.due_date).getTime() < today.getTime()) {
    return false
  }
  return true
}

// Resolve, para cada issue, a data em que ela entrou em alguma das colunas
// "finalizado" configuradas (a mais antiga, se ela passou por mais de uma).
// Cai para closed_at quando não há esse histórico (ex.: token sem permissão
// para eventos de label, ou issue fechada sem nunca ter passado pela coluna).
// Compartilhado entre o burndown da milestone ativa e o histórico de velocidade.
export async function resolveCompletionDates(
  config: GitlabConfig,
  issues: GitlabIssue[],
): Promise<(Date | null)[]> {
  return Promise.all(
    issues.map(async (issue): Promise<Date | null> => {
      try {
        const events = await getIssueResourceLabelEvents(config, issue.iid)
        const adds = events
          .filter((e) => e.action === 'add' && e.label && config.doneLabels.includes(e.label.name))
          .map((e) => new Date(e.created_at))
          .sort((a, b) => a.getTime() - b.getTime())
        if (adds.length > 0) return adds[0]
      } catch {
        // fall through to closed_at fallback below
      }
      if (issue.state === 'closed' && issue.closed_at) return new Date(issue.closed_at)
      return null
    }),
  )
}

export async function computeMilestoneBurndown(
  config: GitlabConfig,
  milestone: GitlabMilestone,
): Promise<MilestoneBurndown> {
  const allIssues = await getMilestoneIssues(config, milestone.id)
  const issues = filterExcludedIssues(allIssues, config.excludeLabels)
  const totalIssues = issues.length
  const hasDueDate = Boolean(milestone.due_date)

  if (totalIssues === 0) {
    return {
      milestone,
      totalIssues: 0,
      completedIssues: 0,
      totalPoints: 0,
      completedPoints: 0,
      issuesWithoutPoints: 0,
      hasPoints: false,
      points: [],
      hasDueDate,
    }
  }

  const issuePoints = issues.map((issue) => getIssuePoints(issue, config.pointLabelPrefix))
  const hasPoints = issuePoints.some((p) => p !== null)
  const issuesWithoutPoints = issuePoints.filter((p) => p === null).length
  const totalPoints = issuePoints.reduce((sum: number, p) => sum + (p ?? 0), 0)

  const completionDates = await resolveCompletionDates(config, issues)

  const today = toDateOnly(new Date())
  const earliestCreated = issues.reduce(
    (min, i) => (i.created_at < min ? i.created_at : min),
    issues[0].created_at,
  )
  const start = milestone.start_date ? parseDateOnly(milestone.start_date) : toDateOnly(new Date(earliestCreated))
  const due = milestone.due_date ? parseDateOnly(milestone.due_date) : null

  let chartEnd = due && due.getTime() > today.getTime() ? due : today
  const maxEnd = addDays(start, MAX_DAYS)
  if (chartEnd.getTime() > maxEnd.getTime()) chartEnd = maxEnd
  if (chartEnd.getTime() < start.getTime()) chartEnd = start

  const points: BurndownPoint[] = []
  const span = due ? due.getTime() - start.getTime() : 0

  for (let d = start; d.getTime() <= chartEnd.getTime(); d = addDays(d, 1)) {
    const dayEnd = addDays(d, 1)
    const completedIndexesByDay = completionDates
      .map((c, index) => (c !== null && c.getTime() < dayEnd.getTime() ? index : -1))
      .filter((index) => index !== -1)
    const completedCountByDay = completedIndexesByDay.length
    const completedPointsByDay = completedIndexesByDay.reduce(
      (sum, index) => sum + (issuePoints[index] ?? 0),
      0,
    )

    const isFuture = d.getTime() > today.getTime()
    const actualIssues = isFuture ? null : totalIssues - completedCountByDay
    const actualPoints = isFuture ? null : totalPoints - completedPointsByDay

    let idealIssues: number | null = null
    let idealPoints: number | null = null
    if (due) {
      const progress = span <= 0 ? (d.getTime() <= start.getTime() ? 0 : 1) : Math.min(1, Math.max(0, (d.getTime() - start.getTime()) / span))
      idealIssues = Math.round(totalIssues * (1 - progress) * 10) / 10
      idealPoints = Math.round(totalPoints * (1 - progress) * 10) / 10
    }

    points.push({ date: formatDateOnly(d), idealIssues, actualIssues, idealPoints, actualPoints })
  }

  const completedIssues = completionDates.filter((c) => c !== null).length
  const completedPoints = completionDates.reduce(
    (sum, c, index) => sum + (c !== null ? (issuePoints[index] ?? 0) : 0),
    0,
  )

  return {
    milestone,
    totalIssues,
    completedIssues,
    totalPoints,
    completedPoints,
    issuesWithoutPoints,
    hasPoints,
    points,
    hasDueDate,
  }
}
