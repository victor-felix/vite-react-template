import { getClosedMilestones, getMilestoneIssues } from './gitlabApi'
import { resolveCompletionDates } from './burndown'
import { filterExcludedIssues, getIssuePoints } from './points'
import type { GitlabConfig, GitlabMilestone } from '../types/gitlab'

export interface SprintVelocity {
  milestone: GitlabMilestone
  totalIssues: number
  completedIssues: number
  totalPoints: number
  completedPoints: number
  hasPoints: boolean
}

const MAX_SPRINTS = 8

async function computeSprintVelocity(
  config: GitlabConfig,
  milestone: GitlabMilestone,
): Promise<SprintVelocity> {
  const allIssues = await getMilestoneIssues(config, milestone.id)
  const issues = filterExcludedIssues(allIssues, config.excludeLabels)

  if (issues.length === 0) {
    return {
      milestone,
      totalIssues: 0,
      completedIssues: 0,
      totalPoints: 0,
      completedPoints: 0,
      hasPoints: false,
    }
  }

  const issuePoints = issues.map((issue) => getIssuePoints(issue, config.pointLabelPrefix))
  const hasPoints = issuePoints.some((p) => p !== null)
  const totalPoints = issuePoints.reduce((sum: number, p) => sum + (p ?? 0), 0)

  const completionDates = await resolveCompletionDates(config, issues)
  const completedIssues = completionDates.filter((c) => c !== null).length
  const completedPoints = completionDates.reduce(
    (sum, c, index) => sum + (c !== null ? (issuePoints[index] ?? 0) : 0),
    0,
  )

  return {
    milestone,
    totalIssues: issues.length,
    completedIssues,
    totalPoints,
    completedPoints,
    hasPoints,
  }
}

// Últimas milestones fechadas (mais antiga primeiro, para ler como um gráfico
// de velocidade cronológico), com os pontos/tarefas entregues em cada uma.
export async function getSprintVelocityHistory(config: GitlabConfig): Promise<SprintVelocity[]> {
  const closedMilestones = await getClosedMilestones(config)
  const recent = closedMilestones.slice(0, MAX_SPRINTS).reverse()
  return Promise.all(recent.map((milestone) => computeSprintVelocity(config, milestone)))
}
