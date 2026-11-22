import { definePlugin } from '@alinha/plugin-sdk'
import { History, Home, LayoutDashboard } from 'lucide-react'
import { ClientHomePage, ConsultantOverviewPage } from './pages/DashboardReportsPage'
import { HistoryPage } from './pages/HistoryPage'

/**
 * The plugin's frontend entry point. The shell reads this object and mounts
 * the routes and the menu — nothing to register by hand in the shell.
 *   area 'client'     → /org/:org/<path>
 *   area 'consultant' → /portfolio/:org/<path>
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
    consultant: [
      { path: 'dashboard', handle: { title: 'Visão geral' }, Component: ConsultantOverviewPage },
      // Change history (#6): consultant only, read from the core's audit trail.
      { path: 'history', handle: { title: 'Histórico', resource: 'audit' }, Component: HistoryPage },
    ],
  },
  nav: [
    { label: 'Início', path: 'dashboard', area: 'client', icon: Home, order: 10 },
    { label: 'Visão geral', path: 'dashboard', area: 'consultant', icon: LayoutDashboard, order: 10 },
    { label: 'Histórico', path: 'history', area: 'consultant', icon: History, resource: 'audit', order: 900 },
  ],
})
