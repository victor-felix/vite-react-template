import { getClosedMilestones, getMilestoneIssues } from './gitlabApi'
import { resolveCompletionDates } from './burndown'
import { filterExcludedIssues, getIssuePoints } from './points'
import type { GitlabConfig, GitlabMilestone } from '../types/gitlab'

export interface SprintVelocity {
  milestone: GitlabMilestone
  totalPoints: number
  completedPoints: number
}

const MAX_SPRINTS = 8

async function computeSprintVelocity(
  config: GitlabConfig,
  milestone: GitlabMilestone,
): Promise<SprintVelocity> {
  const allIssues = await getMilestoneIssues(config, milestone.id)
  const issues = filterExcludedIssues(allIssues, config.excludeLabels)

  if (issues.length === 0) {
    return { milestone, totalPoints: 0, completedPoints: 0 }
  }

  const issuePoints = issues.map((issue) => getIssuePoints(issue, config.pointLabelPrefix))
  const totalPoints = issuePoints.reduce((sum: number, p) => sum + (p ?? 0), 0)

  const completionDates = await resolveCompletionDates(config, issues)
  const completedPoints = completionDates.reduce(
    (sum, c, index) => sum + (c !== null ? (issuePoints[index] ?? 0) : 0),
    0,
  )

  return { milestone, totalPoints, completedPoints }
}

// Pontos entregues nas últimas milestones fechadas (mais antiga primeiro, para
// ler como um gráfico de velocidade cronológico).
export async function getSprintVelocityHistory(config: GitlabConfig): Promise<SprintVelocity[]> {
  const closedMilestones = await getClosedMilestones(config)

  // A API de milestones do GitLab não documenta order_by/sort (diferente de
  // issues/MRs), então a ordem devolvida não é confiável — ordena aqui pela
  // data de término (milestones sem due_date vão para o fim).
  const sorted = [...closedMilestones].sort((a, b) => {
    const aTime = a.due_date ? new Date(a.due_date).getTime() : -Infinity
    const bTime = b.due_date ? new Date(b.due_date).getTime() : -Infinity
    return bTime - aTime
  })
  const recent = sorted.slice(0, MAX_SPRINTS).reverse()

  // Promise.allSettled: uma sprint com erro (permissão, milestone removida
  // entre as duas chamadas, etc.) não pode derrubar o histórico inteiro.
  const results = await Promise.allSettled(recent.map((milestone) => computeSprintVelocity(config, milestone)))
  return results
    .filter((r): r is PromiseFulfilledResult<SprintVelocity> => r.status === 'fulfilled')
    .map((r) => r.value)
}
