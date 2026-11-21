import { definePlugin } from '@alinha/plugin-sdk'
import { DashboardReportsPage } from './pages/DashboardReportsPage'
import { PortfolioDashboardPage } from './pages/PortfolioDashboardPage'

/**
 * The plugin's frontend entry point. The shell reads this object and mounts
 * the routes and the menu — nothing to register by hand in the shell.
 *   area 'client'     → /org/:org/<path>
 *   area 'consultant' → /portfolio/:org/<path>
 *   area 'portfolio'  → /portfolio/<path> (all clients, no organization; ADR 0006)
 * User-visible text (title, label) is in European Portuguese, plain language
 * (UI requirement in the technical report). Paths are in English.
 */
export default definePlugin({
  id: 'dashboard-reports',
  name: 'Dashboard & Reports',
  routes: {
    client: [
      { path: 'dashboard', handle: { title: 'Painel' }, Component: DashboardReportsPage },
    ],
    // Portfolio dashboard (#3): every client of the consultant.
    portfolio: [
      { path: 'overview', handle: { title: 'Visão geral', resource: 'portfolio' }, Component: PortfolioDashboardPage },
    ],
    consultant: [
      { path: 'dashboard', handle: { title: 'Painel' }, Component: DashboardReportsPage },
    ],
  },
  nav: [
    { label: 'Painel', path: 'dashboard', area: 'client' },
    { label: 'Painel', path: 'dashboard', area: 'consultant' },
    { label: 'Visão geral', path: 'overview', area: 'portfolio', resource: 'portfolio', order: 10 },
  ],
})
