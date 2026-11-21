import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
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

function renderPage(api: (path: string) => Promise<unknown>, user: PluginHost['user'] = ME) {
  const spy = vi.fn(api)
  const host: PluginHost = {
    tenantId: 't1',
    organization: { id: 't1', slug: 'acme', name: 'Componentes Águeda, Lda.' },
    user,
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

/**
 * Radix Select keeps a hidden native <select> in sync inside a form; changing it is how a test picks an option
 * without the pointer events jsdom does not have. 0 is "Sobre", 1 is "Quem".
 */
function nativeSelect(index: number): HTMLSelectElement {
  const selects = document.querySelectorAll('form[role="search"] select')
  return selects[index] as HTMLSelectElement
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

  it('filters to the signed-in person by their id', async () => {
    const spy = renderPage(async () => pageOf([]))
    await screen.findByText('Ainda não há alterações registadas')

    fireEvent.change(nativeSelect(1), { target: { value: 'me' } })

    await waitFor(() => expect(lastQuery(spy).get('actor')).toBe(ME.id))
  })

  it('does not offer "only mine" when nobody is signed in', async () => {
    renderPage(async () => pageOf([]), null)
    await screen.findByText('Ainda não há alterações registadas')
    const values = [...nativeSelect(1).options].map((o) => o.value)
    expect(values).not.toContain('me')
    expect(values).toContain('system')
  })

  it('goes back to the last page when the history gets shorter', async () => {
    let total = 45
    const spy = renderPage(async (path) => {
      const page = Number(new URLSearchParams(path.split('?')[1]).get('page') ?? 0)
      return pageOf(page * 20 < total ? [event({ id: `e${page}` })] : [], total, page)
    })
    await screen.findByText(/Página 1 de 3/)
    fireEvent.click(screen.getByRole('button', { name: 'Seguinte' }))
    await screen.findByText(/Página 2 de 3/)
    fireEvent.click(screen.getByRole('button', { name: 'Seguinte' }))
    await screen.findByText(/Página 3 de 3/)

    // Someone's entries drop out of the filter; the open page is refetched when the window gets focus again.
    total = 30
    focusManager.setFocused(false)
    focusManager.setFocused(true)

    expect(await screen.findByText(/Página 2 de 2/)).toBeTruthy()
    expect(lastQuery(spy).get('page')).toBe('1')
    focusManager.setFocused(undefined)
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
