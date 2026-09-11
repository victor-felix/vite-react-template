import { getIssueResourceLabelEvents, getMilestoneIssues } from './gitlabApi'
import type { GitlabConfig, GitlabMilestone } from '../types/gitlab'

export interface BurndownPoint {
  date: string
  ideal: number | null
  actual: number | null
}

export interface MilestoneBurndown {
  milestone: GitlabMilestone
  totalIssues: number
  completedIssues: number
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

export async function computeMilestoneBurndown(
  config: GitlabConfig,
  milestone: GitlabMilestone,
): Promise<MilestoneBurndown> {
  const issues = await getMilestoneIssues(config, milestone.id)
  const totalIssues = issues.length
  const hasDueDate = Boolean(milestone.due_date)

  if (totalIssues === 0) {
    return { milestone, totalIssues: 0, completedIssues: 0, points: [], hasDueDate }
  }

  const completionDates = await Promise.all(
    issues.map(async (issue): Promise<Date | null> => {
      try {
        const events = await getIssueResourceLabelEvents(config, issue.iid)
        const adds = events
          .filter((e) => e.action === 'add' && e.label?.name === config.doneLabel)
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
    const completedByDay = completionDates.filter(
      (c) => c !== null && c.getTime() < dayEnd.getTime(),
    ).length
    const actual = d.getTime() <= today.getTime() ? totalIssues - completedByDay : null

    let ideal: number | null = null
    if (due) {
      if (span <= 0) {
        ideal = d.getTime() <= start.getTime() ? totalIssues : 0
      } else {
        const progress = Math.min(1, Math.max(0, (d.getTime() - start.getTime()) / span))
        ideal = Math.round(totalIssues * (1 - progress) * 10) / 10
      }
    }

    points.push({ date: formatDateOnly(d), ideal, actual })
  }

  const completedIssues = completionDates.filter((c) => c !== null).length

  return { milestone, totalIssues, completedIssues, points, hasDueDate }
}
