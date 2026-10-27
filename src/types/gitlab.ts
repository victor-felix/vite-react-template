export interface GitlabConfig {
  baseUrl: string
  token: string
  projectPath: string
  doneLabels: string[]
  inProgressLabels: string[]
  excludeLabels: string[]
  pointLabelPrefix: string
  bugLabel: string
  reviewLabels: string[]
  testLabels: string[]
  storyLabel: string
  taskLabel: string
  validationWikiPath: string
}

export interface GitlabProject {
  id: number
  name: string
  name_with_namespace: string
  path_with_namespace: string
  web_url: string
}

export interface GitlabMilestone {
  id: number
  iid: number
  title: string
  description: string
  state: 'active' | 'closed'
  start_date: string | null
  due_date: string | null
  web_url: string
}

export interface GitlabIssue {
  id: number
  iid: number
  title: string
  description: string | null
  state: 'opened' | 'closed'
  created_at: string
  closed_at: string | null
  due_date: string | null
  weight: number | null
  labels: string[]
  web_url: string
}

export interface GitlabLabel {
  id: number
  name: string
  color: string
}

export interface GitlabBoardList {
  id: number
  label: GitlabLabel | null
  position: number
}

export interface GitlabBoard {
  id: number
  name: string
}

export interface GitlabResourceLabelEvent {
  id: number
  action: 'add' | 'remove'
  created_at: string
  label: GitlabLabel | null
}

export interface GitlabWikiPage {
  slug: string
  title: string
  format: string
}

export interface GitlabMergeRequest {
  id: number
  iid: number
  title: string
  state: 'opened' | 'closed' | 'merged' | 'locked'
  draft: boolean
  author: {
    name: string
    username: string
  }
  source_branch: string
  target_branch: string
  web_url: string
  created_at: string
  updated_at: string
  labels: string[]
}
