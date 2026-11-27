import { useState } from 'react'
import { ListTree } from 'lucide-react'
import { formatDate, useApiQuery } from '@alinha/plugin-sdk'
import { Badge, Card, Checkbox, EmptyState, ErrorState, Note, PageHeader, SkeletonRows } from '@alinha/ui'
import {
  CONTROL_STATUS_LABEL, DEFAULT_FRAMEWORK, LEVEL_LABEL, labelOf, OUTCOME_LABEL, REASON_LABEL, REQUIREMENT_STATUS_LABEL,
  STRENGTH_LABEL, traceabilityPath, type ControlTrace, type RequirementTrace, type Traceability,
} from './labels'

/**
 * The consultant's traceability view of one client (alinha#26, FR38, FR39, US39): each legal requirement, the
 * controls that satisfy it, their gaps, the roadmap actions and the evidence. Statuses are the Compliance Engine's.
 */
export function TraceabilityPage() {
  const [onlyGaps, setOnlyGaps] = useState(false)
  const path = traceabilityPath(DEFAULT_FRAMEWORK, onlyGaps)
  const trace = useApiQuery<Traceability>(['dashboard-reports', 'traceability'], path)

  const header = (
    <PageHeader title="Rastreabilidade"
      subtitle="De cada requisito legal aos controlos, às falhas, às ações do roadmap e às evidências." />
  )
  if (trace.isPending) return <>{header}<SkeletonRows rows={6} label="A carregar a rastreabilidade…" /></>
  if (trace.isError) return <>{header}<ErrorState error={trace.error} onRetry={() => void trace.refetch()} /></>

  const view = trace.data
  return (
    <>
      {header}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-[0.875rem] text-ink-soft">{view.catalogueTitle} · versão {view.catalogueVersion}</p>
        <Checkbox label="Só requisitos com falhas" checked={onlyGaps} onChange={(e) => setOnlyGaps(e.target.checked)}
          disabled={!view.evaluated} />
      </div>
      {!view.evaluated && (
        <Note className="mb-6">
          Esta organização ainda não tem uma avaliação concluída. O estado de cada controlo aparece aqui quando a
          avaliação for submetida.
        </Note>
      )}
      {view.requirements.length === 0 ? (
        <EmptyState icon={<ListTree className="size-5" aria-hidden />} title="Nenhum requisito com falhas">
          Todos os requisitos avaliados estão cumpridos.
        </EmptyState>
      ) : (
        <ul role="list" aria-label="Requisitos" className="flex flex-col gap-3">
          {view.requirements.map((r) => <li key={r.id}><Requirement requirement={r} /></li>)}
        </ul>
      )}
    </>
  )
}

function Requirement({ requirement: r }: { requirement: RequirementTrace }) {
  return (
    <Card className="p-0">
      <details className="group">
        <summary className="flex cursor-pointer list-none items-start justify-between gap-4 px-5 py-4">
          <span className="flex min-w-0 flex-col gap-1">
            <span className="text-[0.75rem] font-semibold text-muted">{r.id} · {r.reference}</span>
            <span className="text-[0.9375rem] font-semibold text-ink">{r.text}</span>
          </span>
          <Badge tone={r.status === 'gap' ? 'dark' : r.status === 'compliant' ? 'signal' : 'neutral'}>
            {r.status ? REQUIREMENT_STATUS_LABEL[r.status] : 'Por avaliar'}
          </Badge>
        </summary>
        <ul role="list" aria-label={`Controlos de ${r.id}`} className="flex flex-col divide-y divide-line-soft border-t border-line-soft">
          {r.controls.map((c) => <li key={c.id} className="px-5 py-4"><Control control={c} /></li>)}
        </ul>
      </details>
    </Card>
  )
}

function Control({ control: c }: { control: ControlTrace }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-[0.75rem] font-semibold text-muted">{c.id} · nível {labelOf(LEVEL_LABEL, c.level)}</span>
          <span className="text-[0.875rem] text-ink">{c.title}</span>
          {c.reason && <span className="text-[0.8125rem] text-ink-soft">{labelOf(REASON_LABEL, c.reason)}</span>}
        </span>
        <Badge tone={c.status === 'compliant' ? 'signal' : c.status ? 'dark' : 'neutral'}>
          {c.status ? CONTROL_STATUS_LABEL[c.status] : 'Por avaliar'}
        </Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <section aria-label={`Ações de ${c.id}`} className="flex flex-col gap-1">
          <h4 className="text-[0.75rem] font-bold text-ink-soft">Ações no roadmap</h4>
          {c.actions.length === 0 ? (
            <p className="text-[0.8125rem] text-muted">Ainda sem ações.</p>
          ) : (
            <ul role="list" className="flex flex-col gap-1 text-[0.8125rem]">
              {c.actions.map((a) => (
                <li key={a.id}>{a.title}{a.dueDate && <span className="text-ink-soft"> · até {formatDate(a.dueDate)}</span>}</li>
              ))}
            </ul>
          )}
        </section>
        <section aria-label={`Evidências de ${c.id}`} className="flex flex-col gap-1">
          <h4 className="text-[0.75rem] font-bold text-ink-soft">Evidências</h4>
          {c.evidence.length === 0 ? (
            <p className="text-[0.8125rem] text-muted">Ainda sem evidências recolhidas.</p>
          ) : (
            <ul role="list" className="flex flex-col gap-1 text-[0.8125rem]">
              {c.evidence.map((e) => (
                <li key={e.evidenceId}>
                  {OUTCOME_LABEL[e.outcome]}
                  <span className="text-ink-soft"> · {e.provider}, {STRENGTH_LABEL[e.strength]}, {formatDate(e.collectedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
