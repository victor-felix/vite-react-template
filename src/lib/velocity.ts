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
  const recent = closedMilestones.slice(0, MAX_SPRINTS).reverse()
  return Promise.all(recent.map((milestone) => computeSprintVelocity(config, milestone)))
}
