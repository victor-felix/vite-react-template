import type { GitlabIssue } from '../types/gitlab'

// Escala sugerida na tela de Configurações para gerar as labels recomendadas
// no GitLab. O parsing de pontos (getIssuePoints) não depende desta lista —
// qualquer "prefixo<número>" é lido, então valores fora da escala (ex.: 34)
// continuam funcionando normalmente.
export const FIBONACCI_SCALE = [1, 2, 3, 5, 8, 13, 21]

// Cores em degradê (do ramp sequencial azul), da pontuação mais baixa (clara)
// para a mais alta (escura) — mesma cor para o mesmo valor em qualquer projeto.
export const FIBONACCI_LABEL_COLORS: Record<number, string> = {
  1: '#b7d3f6',
  2: '#9ec5f4',
  3: '#6da7ec',
  5: '#3987e5',
  8: '#256abf',
  13: '#184f95',
  21: '#0d366b',
}

export function pointLabelName(prefix: string, value: number): string {
  return `${prefix}${value}`
}

export function getIssuePoints(issue: GitlabIssue, pointLabelPrefix: string): number | null {
  if (!pointLabelPrefix) return null
  const label = issue.labels.find((name) => name.startsWith(pointLabelPrefix))
  if (!label) return null
  const value = Number(label.slice(pointLabelPrefix.length))
  return Number.isFinite(value) ? value : null
}

export function filterExcludedIssues(issues: GitlabIssue[], excludeLabels: string[]): GitlabIssue[] {
  if (excludeLabels.length === 0) return issues
  return issues.filter((issue) => !issue.labels.some((name) => excludeLabels.includes(name)))
}
