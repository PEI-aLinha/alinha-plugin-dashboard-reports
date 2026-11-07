import { useQuery } from '@tanstack/react-query'
import { useHost } from '@alinha/plugin-sdk'
import { PageHeader } from '@alinha/ui'

export function DashboardReportsPage() {
  const { api } = useHost()
  const ping = useQuery({
    queryKey: ['dashboard-reports', 'ping'],
    queryFn: () => api<{ plugin: string; status: string }>('/dashboard-reports/ping'),
  })

  return (
    <>
      <PageHeader title="Dashboard & Reports" />
      <p>Backend: {ping.isPending ? 'a verificar…' : ping.isError ? 'indisponível' : ping.data.status}</p>
    </>
  )
}
