import { useState } from 'react'
import { History } from 'lucide-react'
import type { AuditEventDto, AuditEventPageDto } from '@alinha/api-client'
import { formatDateTime, useApiQuery, useHost } from '@alinha/plugin-sdk'
import { Button, DataTable, EmptyState, ErrorState, Field, PageHeader, Select, SkeletonRows, TextInput, type ColumnDef } from '@alinha/ui'
import { historyQuery, invalidRange, NO_FILTERS, PAGE_SIZE, type HistoryFilters } from '../history/filters'
import { actionLabel, actorLabel, detailsText, ENTITY_TYPES, entityLabel } from '../history/labels'

const ENTITY_OPTIONS = [
  { value: 'all', label: 'Tudo' },
  ...Object.entries(ENTITY_TYPES).map(([value, label]) => ({ value, label })),
]

const ACTOR_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'me', label: 'Só as minhas alterações' },
  { value: 'system', label: 'Só as automáticas (aLinha)' },
]

/**
 * Change history of one client organization (dashboard-reports#6, US09): who changed what and when, read from the
 * core's audit trail (`GET /api/audit/events`). Consultant area only; the route needs `audit:read`.
 */
export function HistoryPage() {
  const { user, organization } = useHost()
  const [filters, setFilters] = useState<HistoryFilters>(NO_FILTERS)
  const [page, setPage] = useState(0)
  const badRange = invalidRange(filters)

  const query = historyQuery(filters, page, user?.id ?? null)
  const history = useApiQuery<AuditEventPageDto>(['dashboard-reports', 'history'], `/audit/events?${query}`, {
    enabled: !badRange,
    // Keeps the current page on screen while the next one loads, so the table does not jump.
    placeholderData: (previous) => previous,
  })

  const change = (patch: Partial<HistoryFilters>) => {
    setFilters((f) => ({ ...f, ...patch }))
    setPage(0)
  }
  const filtered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS)

  const columns: ColumnDef<AuditEventDto>[] = [
    {
      id: 'when',
      header: 'Quando',
      accessorKey: 'occurredAt',
      cell: ({ row }) => <time dateTime={row.original.occurredAt}>{formatDateTime(row.original.occurredAt)}</time>,
      meta: { width: 170 },
    },
    { id: 'who', header: 'Quem', cell: ({ row }) => actorLabel(row.original.actor, user), meta: { width: 190 } },
    {
      id: 'what',
      header: 'O quê',
      cell: ({ row }) => <WhatCell event={row.original} />,
    },
    { id: 'about', header: 'Sobre', cell: ({ row }) => entityLabel(row.original.entityType), meta: { width: 200 } },
  ]

  const data = history.data
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <>
      <PageHeader
        eyebrow={organization?.name}
        title="Histórico de alterações"
        subtitle="Quem mudou o quê e quando nesta organização. Este registo não pode ser alterado nem apagado."
      />

      <form role="search" aria-label="Filtrar o histórico" onSubmit={(e) => e.preventDefault()} className="mb-5 grid gap-4 md:grid-cols-4">
        <Field label="Sobre">
          {(p) => <Select id={p.id} value={filters.entityType} onChange={(v) => change({ entityType: v })} options={ENTITY_OPTIONS} />}
        </Field>
        <Field label="Quem">
          {(p) => (
            <Select id={p.id} value={filters.actor} onChange={(v) => change({ actor: v as HistoryFilters['actor'] })} options={ACTOR_OPTIONS} />
          )}
        </Field>
        <Field label="Desde" optional>
          {(p) => <TextInput id={p.id} type="date" value={filters.fromDay} max={filters.toDay || undefined} onChange={(e) => change({ fromDay: e.target.value })} />}
        </Field>
        <Field label="Até" optional error={badRange ? 'Esta data é anterior à data "Desde".' : undefined}>
          {(p) => (
            <TextInput
              id={p.id}
              type="date"
              value={filters.toDay}
              min={filters.fromDay || undefined}
              aria-describedby={p.describedBy}
              invalid={p.invalid}
              onChange={(e) => change({ toDay: e.target.value })}
            />
          )}
        </Field>
      </form>

      {badRange ? null : history.isPending ? (
        <SkeletonRows rows={6} label="A carregar o histórico…" />
      ) : history.isError ? (
        <ErrorState error={history.error} onRetry={() => history.refetch()} />
      ) : (
        <DataTable
          data={data?.items ?? []}
          columns={columns}
          getRowId={(e) => e.id}
          caption="Histórico de alterações, das mais recentes para as mais antigas"
          renderCard={(e) => <HistoryCard event={e} who={actorLabel(e.actor, user)} />}
          empty={
            <EmptyState className="border-0" icon={<History className="size-5" aria-hidden />} title={filtered ? 'Nenhuma alteração com estes filtros' : 'Ainda não há alterações registadas'}>
              {filtered ? (
                <Button variant="secondary" size="sm" onClick={() => change(NO_FILTERS)}>
                  Limpar os filtros
                </Button>
              ) : (
                'Quando alguém mudar os dados desta organização, a alteração aparece aqui.'
              )}
            </EmptyState>
          }
          footer={
            data && data.total > PAGE_SIZE ? (
              <nav aria-label="Páginas do histórico" className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span className="text-[0.875rem] text-ink-soft" aria-live="polite">
                  Página {page + 1} de {pages} · {data.total} alterações
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                    Anterior
                  </Button>
                  <Button variant="secondary" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)}>
                    Seguinte
                  </Button>
                </div>
              </nav>
            ) : undefined
          }
        />
      )}
    </>
  )
}

function WhatCell({ event }: { event: AuditEventDto }) {
  const details = detailsText(event)
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-semibold">{actionLabel(event.action)}</span>
      {details && <span className="text-[0.8125rem] text-ink-soft">{details}</span>}
      {event.provenance && <span className="text-[0.8125rem] text-ink-soft">Conteúdo sugerido por IA ({event.provenance.model}).</span>}
    </div>
  )
}

function HistoryCard({ event, who }: { event: AuditEventDto; who: string }) {
  return (
    <div className="flex flex-col gap-1">
      <WhatCell event={event} />
      <span className="text-[0.8125rem] text-muted">
        {who} · <time dateTime={event.occurredAt}>{formatDateTime(event.occurredAt)}</time> · {entityLabel(event.entityType)}
      </span>
    </div>
  )
}
