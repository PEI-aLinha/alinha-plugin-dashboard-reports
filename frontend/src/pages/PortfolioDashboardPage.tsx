import { Link, useNavigate } from 'react-router'
import { Briefcase } from 'lucide-react'
import type { PortfolioSummaryDto } from '@alinha/api-client'
import { formatDate, formatNumber, formatPercent, useApiQuery, useHost } from '@alinha/plugin-sdk'
import { Badge, DataTable, EmptyState, ErrorState, PageHeader, SkeletonRows, StatCard, type ColumnDef } from '@alinha/ui'
import { attentionReasons, clientStatus, portfolioRows, type ClientStatus, type PortfolioRow } from '../portfolio/portfolio'

const STATUS_LABEL: Record<ClientStatus, string> = {
  attention: 'Precisa de atenção',
  'not-assessed': 'Sem avaliação',
  'up-to-date': 'Em dia',
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
    <PageHeader title="Visão geral da carteira" subtitle="Todos os seus clientes, com os que precisam de si primeiro." />
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
  if (summary.isError) return <>{header}<ErrorState error={summary.error} onRetry={() => summary.refetch()} /></>

  const rows = portfolioRows(organizations, summary.data.items)
  const needAttention = rows.filter((r) => clientStatus(r.summary) === 'attention').length
  const pending = rows.reduce((n, r) => n + (r.summary?.pendingValidations ?? 0), 0)

  const columns: ColumnDef<PortfolioRow>[] = [
    {
      id: 'client',
      header: 'Cliente',
      cell: ({ row }) => (
        <Link to={clientPath(row.original)} className="font-semibold text-brand hover:underline" onClick={(e) => e.stopPropagation()}>
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
      <div className="mb-6 flex flex-wrap gap-4">
        <StatCard label="Clientes" value={formatNumber(rows.length)} />
        <StatCard label="Precisam de atenção" value={formatNumber(needAttention)} />
        <StatCard label="Validações pendentes" value={formatNumber(pending)} caption="Planos sugeridos por IA à espera da sua validação." />
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
