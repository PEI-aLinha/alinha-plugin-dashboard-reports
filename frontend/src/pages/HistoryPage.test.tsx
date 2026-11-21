import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AuditEventDto, AuditEventPageDto } from '@alinha/api-client'
import { ApiError, PluginHostContext, type PluginHost } from '@alinha/plugin-sdk'
import { HistoryPage } from './HistoryPage'

afterEach(cleanup)

const ME = { id: 'sub-marta', name: 'Marta Ferreira', roles: ['consultant'] }

function event(overrides: Partial<AuditEventDto>): AuditEventDto {
  return {
    id: crypto.randomUUID(),
    actor: 'system',
    action: 'tenant.provisioned',
    entityType: 'tenant',
    entityId: 't1',
    details: {},
    provenance: null,
    occurredAt: '2026-11-20T10:30:00Z',
    ...overrides,
  }
}

function pageOf(items: AuditEventDto[], total = items.length, page = 0): AuditEventPageDto {
  return { items, page, pageSize: 20, total }
}

function renderPage(api: (path: string) => Promise<unknown>) {
  const spy = vi.fn(api)
  const host: PluginHost = {
    tenantId: 't1',
    organization: { id: 't1', slug: 'acme', name: 'Componentes Águeda, Lda.' },
    user: ME,
    can: () => true,
    api: spy as PluginHost['api'],
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <PluginHostContext.Provider value={host}>
        <HistoryPage />
      </PluginHostContext.Provider>
    </QueryClientProvider>,
  )
  return spy
}

/** The query of the last call to host.api. */
function lastQuery(spy: ReturnType<typeof vi.fn>): URLSearchParams {
  const path = spy.mock.calls.at(-1)?.[0] as string
  expect(path.startsWith('/audit/events?')).toBe(true)
  return new URLSearchParams(path.split('?')[1])
}

describe('HistoryPage', () => {
  it('shows who changed what, in plain Portuguese', async () => {
    renderPage(async () =>
      pageOf([
        event({ actor: 'sub-marta', action: 'organization.updated', entityType: 'organization', details: { changed: ['name', 'address'] } }),
        event({ actor: 'sub-rui', action: 'organization.registered', entityType: 'organization' }),
      ]),
    )

    expect(await screen.findAllByText('Alterou os dados da organização')).not.toHaveLength(0)
    expect(screen.getAllByText('Mudou: nome e morada.')).not.toHaveLength(0)
    expect(screen.getAllByText('Marta Ferreira')).not.toHaveLength(0)
    expect(screen.getAllByText('Outro utilizador')).not.toHaveLength(0)
    expect(screen.getByRole('heading', { level: 1, name: 'Histórico de alterações' })).toBeTruthy()
  })

  it('says when there is nothing recorded yet', async () => {
    renderPage(async () => pageOf([]))
    expect(await screen.findByText('Ainda não há alterações registadas')).toBeTruthy()
  })

  it('sends the chosen days and offers to clear the filters when nothing matches', async () => {
    const spy = renderPage(async () => pageOf([]))
    await screen.findByText('Ainda não há alterações registadas')

    fireEvent.change(screen.getByLabelText(/Desde/), { target: { value: '2026-11-01' } })

    await waitFor(() => expect(lastQuery(spy).get('from')).toBe(new Date(2026, 10, 1).toISOString()))
    fireEvent.click(await screen.findByRole('button', { name: 'Limpar os filtros' }))
    await waitFor(() => expect(lastQuery(spy).has('from')).toBe(false))
  })

  it('does not ask the server when "until" is before "from", and says why', async () => {
    const spy = renderPage(async () => pageOf([]))
    await screen.findByText('Ainda não há alterações registadas')
    fireEvent.change(screen.getByLabelText(/Desde/), { target: { value: '2026-11-10' } })
    await waitFor(() => expect(lastQuery(spy).has('from')).toBe(true))
    const calls = spy.mock.calls.length

    fireEvent.change(screen.getByLabelText(/Até/), { target: { value: '2026-11-09' } })

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByText('Esta data é anterior à data "Desde".')).toBeTruthy()
    expect(spy.mock.calls.length).toBe(calls)
  })

  it('pages through long histories', async () => {
    const spy = renderPage(async (path) => {
      const page = Number(new URLSearchParams(path.split('?')[1]).get('page') ?? 0)
      return pageOf([event({ id: `e${page}` })], 45, page)
    })

    expect(await screen.findByText(/Página 1 de 3/)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Anterior' }) as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Seguinte' }))

    expect(await screen.findByText(/Página 2 de 3/)).toBeTruthy()
    expect(lastQuery(spy).get('page')).toBe('1')
  })

  it('shows an error with a retry when the history cannot be read', async () => {
    let fail = true
    renderPage(async () => {
      if (fail) throw new ApiError(503, '/audit/events')
      return pageOf([event({})])
    })

    expect(await screen.findByText('Não conseguimos carregar estes dados')).toBeTruthy()
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findAllByText('Criou a conta da organização')).not.toHaveLength(0)
  })

  it('marks changes that stored AI-generated content', async () => {
    renderPage(async () =>
      pageOf([event({ provenance: { model: 'mistral-small', promptVersion: 'v1', sources: [], generatedAt: '2026-11-20T10:00:00Z' } })]),
    )
    expect(await screen.findAllByText('Conteúdo sugerido por IA (mistral-small).')).not.toHaveLength(0)
  })
})
