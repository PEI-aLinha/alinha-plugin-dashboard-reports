import { definePlugin } from '@alinha/plugin-sdk'
import { DashboardReportsPage } from './pages/DashboardReportsPage'

/**
 * Ponto de entrada do plugin no frontend. O shell lê este objeto e monta
 * as rotas e o menu — não há nada a registar à mão no shell.
 *   area 'client'     → /org/:org/<path>
 *   area 'consultant' → /carteira/<path>
 */
export default definePlugin({
  id: 'dashboard-reports',
  name: 'Dashboard & Reports',
  routes: {
    client: [
      { path: 'dashboard-reports', handle: { title: 'Dashboard & Reports' }, Component: DashboardReportsPage },
    ],
  },
  nav: [
    { label: 'Dashboard & Reports', path: 'dashboard-reports', area: 'client' },
  ],
})
