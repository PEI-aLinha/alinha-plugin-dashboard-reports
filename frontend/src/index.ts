import { definePlugin } from '@alinha/plugin-sdk'
import { Gauge, History, Home, LayoutDashboard, ListTree } from 'lucide-react'
import { ClientHomePage, ConsultantOverviewPage } from './pages/DashboardReportsPage'
import { HistoryPage } from './pages/HistoryPage'
import { PortfolioDashboardPage } from './pages/PortfolioDashboardPage'
import { TraceabilityPage } from './traceability/TraceabilityPage'

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
      { path: 'dashboard', handle: { title: 'Início' }, Component: ClientHomePage },
    ],
    // Portfolio dashboard (#3): every client of the consultant.
    portfolio: [
      { path: 'overview', handle: { title: 'Painel da carteira', resource: 'portfolio' }, Component: PortfolioDashboardPage },
    ],
    consultant: [
      { path: 'dashboard', handle: { title: 'Visão geral' }, Component: ConsultantOverviewPage },
      // Change history (#6): consultant only, read from the core's audit trail.
      { path: 'history', handle: { title: 'Histórico', resource: 'audit' }, Component: HistoryPage },
      // Requirement -> controls -> gaps -> actions -> evidence (alinha#26): consultant only.
      { path: 'traceability', handle: { title: 'Rastreabilidade', resource: 'traceability' }, Component: TraceabilityPage },
    ],
  },
  nav: [
    { label: 'Início', path: 'dashboard', area: 'client', icon: Home, order: 10 },
    { label: 'Visão geral', path: 'dashboard', area: 'consultant', icon: LayoutDashboard, order: 10 },
    { label: 'Rastreabilidade', path: 'traceability', area: 'consultant', icon: ListTree, resource: 'traceability', order: 40 },
    { label: 'Histórico', path: 'history', area: 'consultant', icon: History, resource: 'audit', order: 900 },
    { label: 'Painel da carteira', path: 'overview', area: 'portfolio', icon: Gauge, resource: 'portfolio', order: 10 },
  ],
})
