export interface GitlabConfig {
  baseUrl: string
  token: string
  projectPath: string
  doneLabel: string
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
  state: 'opened' | 'closed'
  created_at: string
  closed_at: string | null
  weight: number | null
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
