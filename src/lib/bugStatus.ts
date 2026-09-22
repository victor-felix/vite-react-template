import { getIssuesByLabel } from './gitlabApi'
import { filterExcludedIssues } from './points'
import type { GitlabConfig, GitlabIssue } from '../types/gitlab'

export interface BugStatusSummary {
  open: number
  inReview: number
  inTest: number
  closed: number
  total: number
}

// Lê todos os cards com a label de bug (aberta ou fechada) e classifica cada
// um pela coluna do board em que está: prioriza "em review", depois "em
// teste" — uma issue com as duas labels ao mesmo tempo (caso raro) conta só
// uma vez, na primeira que bater. O que sobra das abertas cai em "aberto".
export async function computeBugStatusSummary(config: GitlabConfig): Promise<BugStatusSummary> {
  if (!config.bugLabel.trim()) {
    return { open: 0, inReview: 0, inTest: 0, closed: 0, total: 0 }
  }

  const allIssues = await getIssuesByLabel(config, config.bugLabel)
  const issues = filterExcludedIssues(allIssues, config.excludeLabels)

  const isInReview = (issue: GitlabIssue) => issue.labels.some((l) => config.reviewLabels.includes(l))
  const isInTest = (issue: GitlabIssue) => issue.labels.some((l) => config.testLabels.includes(l))

  let open = 0
  let inReview = 0
  let inTest = 0
  let closed = 0

  for (const issue of issues) {
    if (issue.state === 'closed') {
      closed += 1
    } else if (isInReview(issue)) {
      inReview += 1
    } else if (isInTest(issue)) {
      inTest += 1
    } else {
      open += 1
    }
  }

  return { open, inReview, inTest, closed, total: issues.length }
}
