import { describe, expect, it } from 'vitest'
import { historyQuery, invalidRange, isFiltered, NO_FILTERS, startOfDay } from './filters'
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

  it('covers whole Lisbon days: from midnight to the next midnight (to is exclusive)', () => {
    const q = new URLSearchParams(historyQuery({ ...NO_FILTERS, fromDay: '2026-11-02', toDay: '2026-11-02' }, 0, null))
    expect(q.get('from')).toBe('2026-11-02T00:00:00.000Z')
    expect(q.get('to')).toBe('2026-11-03T00:00:00.000Z')
  })

  it('rolls the end of a month over to the next month', () => {
    const q = new URLSearchParams(historyQuery({ ...NO_FILTERS, toDay: '2026-11-30' }, 0, null))
    expect(q.get('to')).toBe('2026-12-01T00:00:00.000Z')
  })
})

describe('startOfDay (Europe/Lisbon, whatever the browser zone)', () => {
  it('is UTC midnight in winter and 23:00 UTC the day before in summer', () => {
    expect(startOfDay('2026-01-15')?.toISOString()).toBe('2026-01-15T00:00:00.000Z')
    expect(startOfDay('2026-07-15')?.toISOString()).toBe('2026-07-14T23:00:00.000Z')
  })

  it('handles the days the clocks change, which are 23 and 25 hours long', () => {
    // 29 March 2026: 01:00 UTC → summer time. 25 October 2026: 01:00 UTC → winter time.
    expect(startOfDay('2026-03-29')?.toISOString()).toBe('2026-03-29T00:00:00.000Z')
    expect(startOfDay('2026-03-29', 1)?.toISOString()).toBe('2026-03-29T23:00:00.000Z')
    expect(startOfDay('2026-10-25')?.toISOString()).toBe('2026-10-24T23:00:00.000Z')
    expect(startOfDay('2026-10-25', 1)?.toISOString()).toBe('2026-10-26T00:00:00.000Z')
  })

  it('rolls over the end of the year', () => {
    expect(startOfDay('2026-12-31', 1)?.toISOString()).toBe('2027-01-01T00:00:00.000Z')
  })

  it('is null for days that are empty or not real dates, so a typed value never crashes the page', () => {
    for (const bad of ['', '2026-11', '0002-11-01', '275761-01-01', '2026-13-01', '2026-02-29', '2026-11-31', 'abcd-ef-gh']) {
      expect(startOfDay(bad), bad).toBeNull()
    }
    expect(startOfDay('2028-02-29')?.toISOString()).toBe('2028-02-29T00:00:00.000Z')
  })

  it('leaves out a day that does not parse instead of sending it', () => {
    const q = new URLSearchParams(historyQuery({ ...NO_FILTERS, fromDay: '0002-11-01', toDay: '2026-11-02' }, 0, null))
    expect(q.has('from')).toBe(false)
    expect(q.get('to')).toBe('2026-11-03T00:00:00.000Z')
  })
})

describe('isFiltered', () => {
  it('is false only with no filter at all, whatever the order of the fields', () => {
    expect(isFiltered(NO_FILTERS)).toBe(false)
    expect(isFiltered({ toDay: '', fromDay: '', actor: 'all', entityType: 'all' })).toBe(false)
    expect(isFiltered({ ...NO_FILTERS, actor: 'system' })).toBe(true)
    expect(isFiltered({ ...NO_FILTERS, entityType: 'organization' })).toBe(true)
    expect(isFiltered({ ...NO_FILTERS, fromDay: '2026-11-01' })).toBe(true)
    expect(isFiltered({ ...NO_FILTERS, toDay: '2026-11-01' })).toBe(true)
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

  it('lists the changed fields in Portuguese, never the code of an unknown field', () => {
    expect(detailsText({ action: 'organization.updated', details: { changed: ['name'] } })).toBe('Mudou: nome.')
    expect(detailsText({ action: 'organization.updated', details: { changed: ['name', 'address', 'turnover'] } })).toBe(
      'Mudou: nome, morada e volume de negócios.',
    )
    expect(detailsText({ action: 'x.y', details: { changed: ['newField', 3] } })).toBe('Mudou: outros dados.')
    expect(detailsText({ action: 'x.y', details: { changed: ['name', 'newField', 'otherField'] } })).toBe('Mudou: nome e outros dados.')
  })

  it('names background jobs and their type, and lets them be filtered', () => {
    expect(actionLabel('job.completed')).toBe('Concluiu uma tarefa automática')
    expect(actionLabel('job.failed')).toBe('Uma tarefa automática falhou')
    expect(entityLabel('job')).toBe('Tarefas automáticas')
    expect(detailsText({ action: 'job.completed', details: { type: 'evidence.collect', version: 1, attempt: 1 } })).toBe(
      'Tarefa: recolha de evidências.',
    )
    expect(detailsText({ action: 'job.dispatched', details: { type: 'report.render' } })).toBe('Tarefa: outra tarefa.')
  })

  it('shows the provider for credentials, and nothing when there are no details', () => {
    expect(detailsText({ action: 'tenant_secret.put', details: { provider: 'github' } })).toBe('Fornecedor: github.')
    expect(detailsText({ action: 'tenant.provisioned', details: {} })).toBeNull()
    expect(detailsText({ action: 'organization.updated', details: { changed: [] } })).toBeNull()
  })
})
