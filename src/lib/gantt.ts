import { getIssueResourceLabelEvents, getMilestoneIssues } from './gitlabApi'
import { filterExcludedIssues } from './points'
import type { GitlabConfig, GitlabIssue, GitlabMilestone } from '../types/gitlab'

export interface GanttBar {
  issue: GitlabIssue
  start: Date
  end: Date
  // false quando a issue nunca passou por uma das colunas "em andamento"
  // configuradas — a barra usa a data de início da milestone como palpite.
  hasConfirmedStart: boolean
  isDone: boolean
  isOverdue: boolean
  // true quando não há due_date, a issue não foi concluída, e a milestone
  // também não tem data de término — a barra vai até hoje sem previsão real.
  isOpenEnded: boolean
}

export interface MilestoneGantt {
  milestone: GitlabMilestone
  bars: GanttBar[]
  rangeStart: Date
  rangeEnd: Date
}

function toDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function parseDateOnly(iso: string): Date {
  return toDateOnly(new Date(iso))
}

// GitLab não tem data de início para issues (só due_date), então a data de
// início da barra é inferida a partir de quando a issue entrou em alguma das
// colunas "em andamento" configuradas (mesmo mecanismo de resource_label_events
// usado para detectar a coluna "finalizado"). O fim usa due_date; na falta
// dele, a data de conclusão; na falta dela, a data de término da milestone;
// e por último hoje (barra em aberto, sem previsão).
async function resolveIssueTimeline(
  config: GitlabConfig,
  issue: GitlabIssue,
): Promise<{ start: Date | null; completed: Date | null }> {
  try {
    const events = await getIssueResourceLabelEvents(config, issue.iid)
    const adds = events.filter((e) => e.action === 'add' && e.label)
    const earliest = (names: string[]): Date | null => {
      const dates = adds
        .filter((e) => e.label && names.includes(e.label.name))
        .map((e) => new Date(e.created_at))
        .sort((a, b) => a.getTime() - b.getTime())
      return dates[0] ?? null
    }
    const completed =
      earliest(config.doneLabels) ??
      (issue.state === 'closed' && issue.closed_at ? new Date(issue.closed_at) : null)
    return { start: earliest(config.inProgressLabels), completed }
  } catch {
    return {
      start: null,
      completed: issue.state === 'closed' && issue.closed_at ? new Date(issue.closed_at) : null,
    }
  }
}

export async function computeMilestoneGantt(
  config: GitlabConfig,
  milestone: GitlabMilestone,
): Promise<MilestoneGantt> {
  const allIssues = await getMilestoneIssues(config, milestone.id)
  const issues = filterExcludedIssues(allIssues, config.excludeLabels)
  const today = toDateOnly(new Date())

  const milestoneStart = milestone.start_date
    ? parseDateOnly(milestone.start_date)
    : issues.length > 0
      ? toDateOnly(
          new Date(
            issues.reduce((min, i) => (i.created_at < min ? i.created_at : min), issues[0].created_at),
          ),
        )
      : today
  const milestoneEnd = milestone.due_date ? parseDateOnly(milestone.due_date) : null

  if (issues.length === 0) {
    return { milestone, bars: [], rangeStart: milestoneStart, rangeEnd: milestoneEnd ?? today }
  }

  const timelines = await Promise.all(issues.map((issue) => resolveIssueTimeline(config, issue)))

  const bars: GanttBar[] = issues.map((issue, index) => {
    const { start: enteredInProgress, completed } = timelines[index]
    const hasConfirmedStart = enteredInProgress !== null
    const start =
      enteredInProgress && enteredInProgress.getTime() > milestoneStart.getTime()
        ? enteredInProgress
        : milestoneStart

    const isDone = completed !== null
    let end: Date
    let isOpenEnded = false
    if (issue.due_date) {
      end = parseDateOnly(issue.due_date)
    } else if (completed) {
      end = completed
    } else if (milestoneEnd) {
      end = milestoneEnd
    } else {
      end = today
      isOpenEnded = true
    }
    if (end.getTime() < start.getTime()) end = start

    const isOverdue = !isDone && end.getTime() < today.getTime()

    return { issue, start, end, hasConfirmedStart, isDone, isOverdue, isOpenEnded }
  })

  bars.sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime())

  const rangeStart = milestoneStart
  const rangeEndCandidates = [milestoneEnd ?? today, today, ...bars.map((b) => b.end)]
  const rangeEnd = new Date(Math.max(...rangeEndCandidates.map((d) => d.getTime())))

  return { milestone, bars, rangeStart, rangeEnd }
}
