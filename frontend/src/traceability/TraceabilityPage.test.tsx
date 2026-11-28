import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError, PluginHostContext, type PluginHost } from '@alinha/plugin-sdk'
import { TraceabilityPage } from './TraceabilityPage'
import type { Traceability } from './labels'

afterEach(cleanup)

const EVALUATED: Traceability = {
  framework: 'nis2-qnrcs',
  catalogueVersion: 1,
  catalogueTitle: 'NIS2 — Regime Jurídico da Cibersegurança',
  engineVersion: 'controls-2026.11-v1',
  evaluated: true,
  requirements: [
    {
      id: 'QNRCS-GR.CO-3',
      reference: 'Regulamento 756/2026, anexos I e III, GR.CO-3',
      text: 'Os requisitos legais são compreendidos e geridos.',
      status: 'gap',
      controls: [
        {
          id: 'GR.CO-3-B', title: 'Requisitos legais identificados', level: 'basic', status: 'gap', reason: 'ANSWERED_NO',
          actions: [{ id: 'a1', title: 'Fazer o inventário das obrigações legais', status: 'open', dueDate: '2026-12-15' }],
          evidence: [{
            provider: 'code-repository', evidenceId: 'e1', outcome: 'NOT_SATISFIED', strength: 'TECHNICALLY_VERIFIED',
            collectedAt: '2026-11-25T10:00:00Z',
          }],
        },
      ],
    },
    {
      id: 'QNRCS-GR.CO-1',
      reference: 'Regulamento 756/2026, anexos I e III, GR.CO-1',
      text: 'A missão e os objetivos são definidos.',
      status: 'compliant',
      controls: [{ id: 'GR.CO-1-S', title: 'Missão definida', level: 'substantial', status: 'compliant', reason: null, actions: [], evidence: [] }],
    },
  ],
}

const NOT_EVALUATED: Traceability = {
  ...EVALUATED,
  engineVersion: null,
  evaluated: false,
  requirements: EVALUATED.requirements.map((r) => ({
    ...r, status: null, controls: r.controls.map((c) => ({ ...c, status: null, reason: null, actions: [], evidence: [] })),
  })),
}

function renderPage(api: (path: string) => Promise<unknown>) {
  const spy = vi.fn(api)
  const host: PluginHost = {
    tenantId: 't1',
    organization: { id: 't1', slug: 'acme', name: 'Componentes Águeda, Lda.' },
    user: { id: 'sub-marta', name: 'Marta Ferreira', roles: ['consultant'] },
    can: () => true,
    api: spy as PluginHost['api'],
    reauthenticate: async () => {},
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <PluginHostContext.Provider value={host}><TraceabilityPage /></PluginHostContext.Provider>
    </QueryClientProvider>,
  )
  return spy
}

describe('TraceabilityPage', () => {
  it('shows each requirement with its status, and its controls with gap, actions and evidence', async () => {
    renderPage(async () => EVALUATED)

    const requirements = await screen.findByRole('list', { name: 'Requisitos' })
    expect(within(requirements).getByText('Com falhas')).toBeTruthy()
    expect(within(requirements).getAllByText('Cumpre').length).toBeGreaterThan(0)

    const controls = screen.getByRole('list', { name: 'Controlos de QNRCS-GR.CO-3' })
    expect(within(controls).getByText('Falha')).toBeTruthy()
    expect(within(controls).getByText('Respondeu que não')).toBeTruthy()
    expect(within(controls).getByText(/nível Básico/)).toBeTruthy()
    expect(within(controls).getByText('Fazer o inventário das obrigações legais')).toBeTruthy()
    expect(within(controls).getByText('Mostra uma falha')).toBeTruthy()
    expect(within(controls).getByText(/Repositório de código, verificado nos sistemas/)).toBeTruthy()
  })

  it('says when there are no actions or evidence yet', async () => {
    renderPage(async () => EVALUATED)

    const controls = await screen.findByRole('list', { name: 'Controlos de QNRCS-GR.CO-1' })
    expect(within(controls).getByText('Ainda sem ações.')).toBeTruthy()
    expect(within(controls).getByText('Ainda sem evidências recolhidas.')).toBeTruthy()
  })

  it('before any evaluation, explains it and shows every control as still to evaluate', async () => {
    renderPage(async () => NOT_EVALUATED)

    expect(await screen.findByText(/ainda não tem uma avaliação concluída/)).toBeTruthy()
    expect(screen.getAllByText('Por avaliar').length).toBeGreaterThan(0)
    expect(screen.queryByText('Falha')).toBeNull()
    expect((screen.getByLabelText('Só requisitos com falhas') as HTMLInputElement).disabled).toBe(true)
  })

  it('asks the server for the requirements with gaps only', async () => {
    const api = renderPage(async (path) => (path.includes('onlyGaps') ? { ...EVALUATED, requirements: [EVALUATED.requirements[0]] } : EVALUATED))

    fireEvent.click(await screen.findByLabelText('Só requisitos com falhas'))

    await waitFor(() => expect(api).toHaveBeenLastCalledWith(
      '/dashboard-reports/traceability/nis2-qnrcs?onlyGaps=true', expect.anything(),
    ))
    await waitFor(() => expect(screen.queryByText('A missão e os objetivos são definidos.')).toBeNull())
  })

  it('keeps the filter focused and the list on screen while the filtered answer loads', async () => {
    let answer: (value: Traceability) => void = () => {}
    renderPage(async (path) => (path.includes('onlyGaps')
      ? new Promise<Traceability>((resolve) => { answer = resolve })
      : EVALUATED))
    const filter = await screen.findByLabelText('Só requisitos com falhas')
    filter.focus()

    fireEvent.click(filter)

    // Still the same checkbox, still focused, and the previous requirements still shown while loading.
    expect(document.activeElement).toBe(screen.getByLabelText('Só requisitos com falhas'))
    expect(screen.getByText('A missão e os objetivos são definidos.')).toBeTruthy()
    answer({ ...EVALUATED, requirements: [EVALUATED.requirements[0]] })
    await waitFor(() => expect(screen.queryByText('A missão e os objetivos são definidos.')).toBeNull())
    expect(document.activeElement).toBe(screen.getByLabelText('Só requisitos com falhas'))
  })

  it('says "all compliant" only for the gaps filter of an evaluated client, never with no data', async () => {
    renderPage(async (path) => (path.includes('onlyGaps') ? { ...EVALUATED, requirements: [] } : EVALUATED))
    fireEvent.click(await screen.findByLabelText('Só requisitos com falhas'))
    expect(await screen.findByText('Nenhum requisito com falhas')).toBeTruthy()

    cleanup()
    renderPage(async () => ({ ...NOT_EVALUATED, requirements: [] }))
    expect(await screen.findByText('Este referencial não tem requisitos')).toBeTruthy()
    expect(screen.queryByText(/estão cumpridos/)).toBeNull()
  })

  it('shows a value it does not know as it comes, never "undefined"', async () => {
    const novel = structuredClone(EVALUATED)
    novel.requirements[0].controls[0].evidence[0].strength = 'AUDITOR_VERIFIED' as never
    renderPage(async () => novel)

    expect(await screen.findByText(/AUDITOR_VERIFIED/)).toBeTruthy()
    expect(screen.queryByText(/undefined/)).toBeNull()
  })

  it('shows an error with a retry', async () => {
    renderPage(async () => { throw new ApiError(500, '/dashboard-reports/traceability/nis2-qnrcs') })

    expect(await screen.findByRole('button', { name: 'Tentar de novo' })).toBeTruthy()
  })
})
