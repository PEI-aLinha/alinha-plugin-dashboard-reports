import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { PortfolioClientSummaryDto } from '@alinha/api-client'
import { ApiError, PluginHostContext, type HostOrganization, type PluginHost } from '@alinha/plugin-sdk'
import { PortfolioDashboardPage } from './PortfolioDashboardPage'

afterEach(cleanup)

const ACME = { id: 't-acme', slug: 'acme', name: 'Acme, Lda.' }
const BETA = { id: 't-beta', slug: 'beta', name: 'Beta, S.A.' }
const GAMA = { id: 't-gama', slug: 'gama', name: 'Gama, Lda.' }

function summary(tenantId: string, overrides: Partial<PortfolioClientSummaryDto> = {}): PortfolioClientSummaryDto {
  return { tenantId, coverage: 0.62, openGaps: 4, pendingValidations: 0, overdueActions: 0, lastAssessedAt: '2026-11-10T10:00:00Z', ...overrides }
}

function renderPage(api: (path: string) => Promise<unknown>, organizations: HostOrganization[] = [ACME, BETA, GAMA]) {
  const spy = vi.fn(api)
  const host: PluginHost = {
    tenantId: null,
    organization: null,
    organizations,
    user: { id: 'u1', name: 'Marta Ferreira', roles: ['consultant'] },
    can: () => true,
    api: spy as PluginHost['api'],
    reauthenticate: async () => {},
  }
  const router = createMemoryRouter(
    [
      { path: '/portfolio/overview', element: <PortfolioDashboardPage /> },
      { path: '/portfolio/:org', element: <h1>Página do cliente</h1> },
    ],
    { initialEntries: ['/portfolio/overview'] },
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <PluginHostContext.Provider value={host}>
        <RouterProvider router={router} />
      </PluginHostContext.Provider>
    </QueryClientProvider>,
  )
  return { spy, router }
}

describe('PortfolioDashboardPage', () => {
  it('lists every client, the ones needing attention first, with why', async () => {
    renderPage(async () => ({
      items: [summary(ACME.id, { coverage: 0.8 }), summary(BETA.id, { pendingValidations: 2, overdueActions: 1 })],
    }))

    const table = await screen.findByRole('table')
    const names = within(table).getAllByRole('link').map((a) => a.textContent)
    expect(names).toEqual(['Beta, S.A.', 'Gama, Lda.', 'Acme, Lda.'])
    expect(within(table).getByText('2 validações pendentes · 1 ação em atraso')).toBeTruthy()
    expect(within(table).getAllByText('Sem avaliação')).toHaveLength(1)
    expect(within(table).getByText(/80\s?%/)).toBeTruthy()
  })

  it('sums the portfolio in the cards', async () => {
    renderPage(async () => ({
      items: [summary(ACME.id, { pendingValidations: 1 }), summary(BETA.id, { pendingValidations: 2 })],
    }))
    await screen.findByRole('table')
    const card = (label: string) => screen.getByRole('group', { name: label })
    expect(within(card('Clientes')).getByText('3')).toBeTruthy()
    expect(within(card('Precisam de atenção')).getByText('2')).toBeTruthy()
    expect(within(card('Validações pendentes')).getByText('3')).toBeTruthy()
  })

  it('opens a client from the list', async () => {
    const { router } = renderPage(async () => ({ items: [] }))
    fireEvent.click(await screen.findByRole('link', { name: 'Acme, Lda.' }))
    expect(await screen.findByRole('heading', { name: 'Página do cliente' })).toBeTruthy()
    expect(router.state.location.pathname).toBe('/portfolio/acme')
  })

  it('calls the portfolio endpoint, which takes no tenant', async () => {
    const { spy } = renderPage(async () => ({ items: [] }))
    await screen.findByRole('table')
    expect(spy.mock.calls[0][0]).toBe('/dashboard-reports/portfolio')
  })

  it('explains an empty portfolio without calling the server', async () => {
    const { spy } = renderPage(async () => ({ items: [] }), [])
    expect(await screen.findByText('Ainda não tem clientes atribuídos')).toBeTruthy()
    expect(spy).not.toHaveBeenCalled()
  })

  it('still lists the clients while the figures do not exist yet', async () => {
    renderPage(async () => {
      throw new ApiError(404, '/dashboard-reports/portfolio')
    })
    expect(await screen.findByText(/ainda não estão disponíveis/)).toBeTruthy()
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('link').map((a) => a.textContent)).toEqual(['Acme, Lda.', 'Beta, S.A.', 'Gama, Lda.'])
    expect(within(table).getAllByText('Sem avaliação')).toHaveLength(3)
  })

  it('shows each client as a card on small screens too', async () => {
    renderPage(async () => ({ items: [summary(ACME.id, { coverage: 0.8, openGaps: 4 })] }))
    await screen.findByRole('table')
    expect(screen.getByText(/Cobertura 80\s?% · 4 lacunas/)).toBeTruthy()
  })

  it('shows an error with a retry', async () => {
    let fail = true
    renderPage(async () => {
      if (fail) throw new ApiError(503, '/dashboard-reports/portfolio')
      return { items: [] }
    })
    expect(await screen.findByText('Não conseguimos carregar estes dados')).toBeTruthy()
    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
    expect(await screen.findByRole('table')).toBeTruthy()
  })
})
