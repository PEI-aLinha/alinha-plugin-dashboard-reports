import type { PortfolioClientSummaryDto } from '@alinha/api-client'
import type { HostOrganization } from '@alinha/plugin-sdk'

/** One client of the portfolio, with its numbers when it has any (`summary` is null before the first assessment). */
export interface PortfolioRow {
  organization: HostOrganization
  summary: PortfolioClientSummaryDto | null
}

export type ClientStatus = 'attention' | 'not-assessed' | 'up-to-date'

/**
 * Attention rules (dashboard-reports#3): a client needs the consultant when a roadmap waits for their validation or a
 * roadmap action is overdue. These are workflow rules over counts, not a compliance verdict: whether a control is in
 * place comes only from the Compliance Engine (NFR05), which is why "up to date" says nothing about compliance.
 */
export function clientStatus(summary: PortfolioClientSummaryDto | null): ClientStatus {
  if (!summary || summary.coverage === null) {
    if (summary && (summary.pendingValidations > 0 || summary.overdueActions > 0)) return 'attention'
    return 'not-assessed'
  }
  return summary.pendingValidations > 0 || summary.overdueActions > 0 ? 'attention' : 'up-to-date'
}

const STATUS_ORDER: Record<ClientStatus, number> = { attention: 0, 'not-assessed': 1, 'up-to-date': 2 }

/**
 * Every client of the session's portfolio, joined with the summary the backend has for it, in the order the consultant
 * should look at them: those needing attention first, then those never assessed, then the rest by lowest coverage.
 * Ties go by name. Summaries for an organization the session does not list are ignored (the token is the authority).
 */
export function portfolioRows(organizations: readonly HostOrganization[], items: readonly PortfolioClientSummaryDto[]): PortfolioRow[] {
  const byTenant = new Map(items.map((s) => [s.tenantId, s]))
  return organizations
    .map((organization) => ({ organization, summary: byTenant.get(organization.id) ?? null }))
    .sort((a, b) => {
      const sa = clientStatus(a.summary)
      const sb = clientStatus(b.summary)
      return (
        STATUS_ORDER[sa] - STATUS_ORDER[sb] ||
        (a.summary?.coverage ?? 0) - (b.summary?.coverage ?? 0) ||
        a.organization.name.localeCompare(b.organization.name, 'pt')
      )
    })
}

/** Why a client needs attention, in plain Portuguese ("2 validações pendentes · 1 ação em atraso"). */
export function attentionReasons(summary: PortfolioClientSummaryDto | null): string | null {
  if (!summary) return null
  const reasons: string[] = []
  if (summary.pendingValidations > 0) {
    reasons.push(summary.pendingValidations === 1 ? '1 validação pendente' : `${summary.pendingValidations} validações pendentes`)
  }
  if (summary.overdueActions > 0) {
    reasons.push(summary.overdueActions === 1 ? '1 ação em atraso' : `${summary.overdueActions} ações em atraso`)
  }
  return reasons.length ? reasons.join(' · ') : null
}
