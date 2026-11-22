import { describe, expect, it } from 'vitest'
import type { PortfolioClientSummaryDto } from '@alinha/api-client'
import { attentionReasons, clientStatus, portfolioRows } from './portfolio'

const org = (id: string, name: string) => ({ id, slug: id, name })

function summary(tenantId: string, overrides: Partial<PortfolioClientSummaryDto> = {}): PortfolioClientSummaryDto {
  return { tenantId, coverage: 0.5, openGaps: 3, pendingValidations: 0, overdueActions: 0, lastAssessedAt: '2026-11-10T10:00:00Z', ...overrides }
}

describe('clientStatus', () => {
  it('needs attention with a pending validation or an overdue action', () => {
    expect(clientStatus(summary('a', { pendingValidations: 1 }))).toBe('attention')
    expect(clientStatus(summary('a', { overdueActions: 2 }))).toBe('attention')
    expect(clientStatus(summary('a', { coverage: null, pendingValidations: 1 }))).toBe('attention')
  })

  it('is "not assessed" without a summary or a coverage, and "up to date" otherwise', () => {
    expect(clientStatus(null)).toBe('not-assessed')
    expect(clientStatus(summary('a', { coverage: null, lastAssessedAt: null }))).toBe('not-assessed')
    expect(clientStatus(summary('a'))).toBe('up-to-date')
  })
})

describe('portfolioRows', () => {
  it('lists every client, attention first, then never assessed, then lowest coverage, then by name', () => {
    const orgs = [org('t1', 'Zeta'), org('t2', 'Beta'), org('t3', 'Alfa'), org('t4', 'Gama'), org('t5', 'Delta')]
    const rows = portfolioRows(orgs, [
      summary('t1', { coverage: 0.9 }),
      summary('t2', { coverage: 0.3 }),
      summary('t4', { coverage: 0.8, overdueActions: 1 }),
      summary('t5', { coverage: 0.3 }),
    ])
    expect(rows.map((r) => r.organization.name)).toEqual(['Gama', 'Alfa', 'Beta', 'Delta', 'Zeta'])
    expect(rows.find((r) => r.organization.id === 't3')?.summary).toBeNull()
  })

  it('puts an unknown coverage after the known ones, not as 0 %', () => {
    const orgs = [org('t1', 'Alfa'), org('t2', 'Beta')]
    const rows = portfolioRows(orgs, [
      summary('t1', { coverage: null, pendingValidations: 1 }),
      summary('t2', { coverage: 0.1, pendingValidations: 1 }),
    ])
    expect(rows.map((r) => r.organization.name)).toEqual(['Beta', 'Alfa'])
  })

  it('ignores a summary for an organization the session does not list', () => {
    expect(portfolioRows([org('t1', 'Acme')], [summary('t1'), summary('other')]).map((r) => r.organization.id)).toEqual(['t1'])
  })
})

describe('attentionReasons', () => {
  it('says why, with singular and plural', () => {
    expect(attentionReasons(summary('a', { pendingValidations: 1 }))).toBe('1 validação pendente')
    expect(attentionReasons(summary('a', { pendingValidations: 2, overdueActions: 1 }))).toBe('2 validações pendentes · 1 ação em atraso')
    expect(attentionReasons(summary('a', { overdueActions: 3 }))).toBe('3 ações em atraso')
  })

  it('is null when there is nothing to say', () => {
    expect(attentionReasons(summary('a'))).toBeNull()
    expect(attentionReasons(null)).toBeNull()
  })
})
