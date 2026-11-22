import { Link, useNavigate } from 'react-router'
import { Briefcase } from 'lucide-react'
import type { PortfolioSummaryDto } from '@alinha/api-client'
import { ApiError, formatDate, formatNumber, formatPercent, useApiQuery, useHost } from '@alinha/plugin-sdk'
import { Badge, DataTable, EmptyState, ErrorState, Note, PageHeader, SkeletonRows, StatCard, type ColumnDef } from '@alinha/ui'
import { attentionReasons, clientStatus, portfolioRows, type ClientStatus, type PortfolioRow } from '../portfolio/portfolio'

const STATUS_LABEL: Record<ClientStatus, string> = {
  attention: 'Precisa de atenção',
  'not-assessed': 'Sem avaliação',
  'up-to-date': 'Sem pendentes',
}

const clientPath = (row: PortfolioRow) => `/portfolio/${encodeURIComponent(row.organization.slug)}`

/**
 * The consultant's portfolio dashboard (dashboard-reports#3, FR26, US08): every assigned client, those needing
 * attention first. Portfolio area (`/portfolio/overview`, ADR 0006): no organization, no tenant header.
 */
export function PortfolioDashboardPage() {
  const { organizations = [] } = useHost()
  const navigate = useNavigate()
  const summary = useApiQuery<PortfolioSummaryDto>(['dashboard-reports', 'portfolio'], '/dashboard-reports/portfolio', {
    enabled: organizations.length > 0,
  })

  const header = (
    <PageHeader title="Painel da carteira" subtitle="Todos os seus clientes, com os que precisam de si primeiro." />
  )

  if (organizations.length === 0) {
    return (
      <>
        {header}
        <EmptyState icon={<Briefcase className="size-5" aria-hidden />} title="Ainda não tem clientes atribuídos">
          Quando lhe atribuírem uma organização, ela aparece aqui.
        </EmptyState>
      </>
    )
  }
  if (summary.isPending) return <>{header}<SkeletonRows rows={5} label="A carregar a carteira…" /></>
  // The figures come from dashboard-reports#2. Until that endpoint exists (404/501), the page still lists the clients.
  const notYet = summary.isError && summary.error instanceof ApiError && [404, 501].includes(summary.error.status)
  if (summary.isError && !notYet) return <>{header}<ErrorState error={summary.error} onRetry={() => summary.refetch()} /></>

  const rows = portfolioRows(organizations, summary.data?.items ?? [])
  const needAttention = rows.filter((r) => clientStatus(r.summary) === 'attention').length
  const pending = rows.reduce((n, r) => n + (r.summary?.pendingValidations ?? 0), 0)

  const columns: ColumnDef<PortfolioRow>[] = [
    {
      id: 'client',
      header: 'Cliente',
      cell: ({ row }) => (
        <Link to={clientPath(row.original)} className="font-semibold text-brand hover:underline">
          {row.original.organization.name}
        </Link>
      ),
    },
    { id: 'status', header: 'Estado', cell: ({ row }) => <StatusCell row={row.original} />, meta: { width: 260 } },
    { id: 'coverage', header: 'Cobertura', cell: ({ row }) => formatPercent(row.original.summary?.coverage), meta: { width: 110, align: 'right' } },
    { id: 'gaps', header: 'Lacunas', cell: ({ row }) => formatNumber(row.original.summary?.openGaps), meta: { width: 100, align: 'right' } },
    {
      id: 'assessed',
      header: 'Última avaliação',
      cell: ({ row }) => formatDate(row.original.summary?.lastAssessedAt),
      meta: { width: 150 },
    },
  ]

  return (
    <>
      {header}
      {notYet && (
        <div className="mb-6">
          <Note>Os indicadores da carteira ainda não estão disponíveis. Por agora, só a lista de clientes.</Note>
        </div>
      )}
      <div className="mb-6 flex flex-wrap gap-4">
        <Stat label="Clientes" value={formatNumber(rows.length)} />
        <Stat label="Precisam de atenção" value={formatNumber(needAttention)} />
        <Stat label="Validações pendentes" value={formatNumber(pending)} caption="Planos sugeridos por IA à espera da sua validação." />
      </div>
      <DataTable
        data={rows}
        columns={columns}
        getRowId={(r) => r.organization.id}
        caption="Clientes da carteira, os que precisam de atenção primeiro"
        onRowClick={(r) => navigate(clientPath(r))}
        rowLabel={(r) => `Abrir ${r.organization.name}`}
        renderCard={(r) => (
          <div className="flex flex-col gap-1">
            <span className="font-semibold">{r.organization.name}</span>
            <StatusCell row={r} />
            <span className="text-[0.8125rem] text-muted">
              Cobertura {formatPercent(r.summary?.coverage)} · {formatNumber(r.summary?.openGaps)} lacunas
            </span>
          </div>
        )}
      />
    </>
  )
}

/** A stat card that screen readers (and tests) can find by its label. */
function Stat({ label, value, caption }: { label: string; value: string; caption?: string }) {
  return (
    <div role="group" aria-label={label} className="flex min-w-0 flex-1">
      <StatCard label={label} value={value} caption={caption} />
    </div>
  )
}

function StatusCell({ row }: { row: PortfolioRow }) {
  const status = clientStatus(row.summary)
  const reasons = attentionReasons(row.summary)
  return (
    <div className="flex flex-col items-start gap-1">
      <Badge tone={status === 'attention' ? 'dark' : status === 'not-assessed' ? 'outline' : 'neutral'}>{STATUS_LABEL[status]}</Badge>
      {reasons && <span className="text-[0.8125rem] text-ink-soft">{reasons}</span>}
    </div>
  )
}
