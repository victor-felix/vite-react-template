import { NavLink, Outlet } from 'react-router-dom'
import { useConfig } from '../lib/config'

export function Layout() {
  const { config } = useConfig()

  return (
    <div className="app-shell">
      <nav className="app-nav">
        <NavLink to="/" className="app-nav__brand">
          GitLab Burndown
        </NavLink>
        <div className="app-nav__links">
          <NavLink
            to="/"
            end
            className={({ isActive }) => `app-nav__link${isActive ? ' is-active' : ''}`}
          >
            Relatório
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) => `app-nav__link${isActive ? ' is-active' : ''}`}
          >
            Configurações
          </NavLink>
          {config && (
            <span className="app-nav__link" style={{ color: 'var(--text-muted)' }}>
              {config.projectPath}
            </span>
          )}
        </div>
      </nav>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
