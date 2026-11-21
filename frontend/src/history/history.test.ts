import { describe, expect, it } from 'vitest'
import { historyQuery, invalidRange, NO_FILTERS } from './filters'
import { actionLabel, actorLabel, detailsText, entityLabel } from './labels'

const me = { id: 'sub-marta', name: 'Marta Ferreira' }

describe('historyQuery', () => {
  it('sends only the page size when nothing is filtered', () => {
    expect(historyQuery(NO_FILTERS, 0, me.id)).toBe('pageSize=20')
  })

  it('sends the entity type, the page and "system" as given', () => {
    const q = new URLSearchParams(historyQuery({ ...NO_FILTERS, entityType: 'organization', actor: 'system' }, 2, me.id))
    expect(q.get('entityType')).toBe('organization')
    expect(q.get('actor')).toBe('system')
    expect(q.get('page')).toBe('2')
  })

  it('turns "me" into the signed-in user id, and drops it without a user', () => {
    expect(new URLSearchParams(historyQuery({ ...NO_FILTERS, actor: 'me' }, 0, me.id)).get('actor')).toBe(me.id)
    expect(new URLSearchParams(historyQuery({ ...NO_FILTERS, actor: 'me' }, 0, null)).has('actor')).toBe(false)
  })

  it('covers whole local days: from midnight to the next midnight (to is exclusive)', () => {
    const q = new URLSearchParams(historyQuery({ ...NO_FILTERS, fromDay: '2026-11-02', toDay: '2026-11-02' }, 0, null))
    expect(q.get('from')).toBe(new Date(2026, 10, 2).toISOString())
    expect(q.get('to')).toBe(new Date(2026, 10, 3).toISOString())
  })

  it('rolls the end of a month over to the next month', () => {
    const q = new URLSearchParams(historyQuery({ ...NO_FILTERS, toDay: '2026-11-30' }, 0, null))
    expect(q.get('to')).toBe(new Date(2026, 11, 1).toISOString())
  })
})

describe('invalidRange', () => {
  it('is true only when both days are set and "until" is before "from"', () => {
    expect(invalidRange({ ...NO_FILTERS, fromDay: '2026-11-10', toDay: '2026-11-09' })).toBe(true)
    expect(invalidRange({ ...NO_FILTERS, fromDay: '2026-11-10', toDay: '2026-11-10' })).toBe(false)
    expect(invalidRange({ ...NO_FILTERS, fromDay: '2026-11-10' })).toBe(false)
  })
})

describe('labels', () => {
  it('names known actions and entities, and never shows a raw code for unknown ones', () => {
    expect(actionLabel('organization.updated')).toBe('Alterou os dados da organização')
    expect(actionLabel('risk.created')).toBe('Outra alteração')
    expect(entityLabel('organization')).toBe('Dados da organização')
    expect(entityLabel('risk')).toBe('Outro')
  })

  it('names the platform and the signed-in person; other people stay anonymous until #75', () => {
    expect(actorLabel('system', me)).toBe('aLinha (automático)')
    expect(actorLabel('sub-marta', me)).toBe('Marta Ferreira')
    expect(actorLabel('sub-rui', me)).toBe('Outro utilizador')
    expect(actorLabel('sub-rui', null)).toBe('Outro utilizador')
  })

  it('lists the changed fields in Portuguese, keeping unknown field names', () => {
    expect(detailsText({ action: 'organization.updated', details: { changed: ['name'] } })).toBe('Mudou: nome.')
    expect(detailsText({ action: 'organization.updated', details: { changed: ['name', 'address', 'turnover'] } })).toBe(
      'Mudou: nome, morada e volume de negócios.',
    )
    expect(detailsText({ action: 'x.y', details: { changed: ['newField', 3] } })).toBe('Mudou: newField.')
  })

  it('shows the provider for credentials, and nothing when there are no details', () => {
    expect(detailsText({ action: 'tenant_secret.put', details: { provider: 'github' } })).toBe('Fornecedor: github.')
    expect(detailsText({ action: 'tenant.provisioned', details: {} })).toBeNull()
    expect(detailsText({ action: 'organization.updated', details: { changed: [] } })).toBeNull()
  })
})
