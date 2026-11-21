import type { AuditEventDto } from '@alinha/api-client'

/**
 * Plain-language text for what the audit trail records. The audit trail stores codes (`organization.updated`,
 * `name`), so each one the platform writes today gets a Portuguese label here. Unknown codes fall back to a
 * generic text, so a new action never shows up as a raw code and never breaks the page.
 * When a plugin starts recording a new action, add its label here.
 */
const ACTIONS: Record<string, string> = {
  'organization.registered': 'Registou a organização',
  'organization.updated': 'Alterou os dados da organização',
  'tenant.provisioned': 'Criou a conta da organização',
  'tenant_secret.put': 'Guardou as credenciais de um fornecedor',
  'tenant_secret.delete': 'Apagou as credenciais de um fornecedor',
}

/** Entity types, for the "Sobre" column and the filter. */
export const ENTITY_TYPES: Record<string, string> = {
  organization: 'Dados da organização',
  tenant: 'Conta da organização',
  provider_credential: 'Credenciais de fornecedor',
}

/** Field names in `details.changed` of `organization.updated` (organization plugin). */
const FIELDS: Record<string, string> = {
  name: 'nome',
  cae: 'CAE',
  sector: 'setor',
  subsector: 'subsetor',
  services: 'serviços',
  employees: 'número de trabalhadores',
  turnover: 'volume de negócios',
  address: 'morada',
  contacts: 'contactos',
  permanentContact: 'ponto de contacto permanente',
}

/** Who did a change, as recorded by the core (docs/audit.md). */
export const SYSTEM_ACTOR = 'system'

export function actionLabel(action: string): string {
  return ACTIONS[action] ?? 'Outra alteração'
}

export function entityLabel(entityType: string): string {
  return ENTITY_TYPES[entityType] ?? 'Outro'
}

/**
 * The actor is a Keycloak `sub` (names are not stored in the audit trail). Until the platform can resolve other
 * people's names (alinha#75), only the person signed in and the platform itself are named.
 */
export function actorLabel(actor: string, me: { id: string; name: string } | null): string {
  if (actor === SYSTEM_ACTOR) return 'aLinha (automático)'
  if (me && actor === me.id) return me.name
  return 'Outro utilizador'
}

/** A short sentence with what the entry's details say, or null when there is nothing to add. */
export function detailsText(event: Pick<AuditEventDto, 'action' | 'details'>): string | null {
  const { details } = event
  const changed = details.changed
  if (Array.isArray(changed) && changed.length > 0) {
    const names = changed.filter((f): f is string => typeof f === 'string').map((f) => FIELDS[f] ?? f)
    return `Mudou: ${joinPt(names)}.`
  }
  if (typeof details.provider === 'string') return `Fornecedor: ${details.provider}.`
  return null
}

/** "a", "a e b", "a, b e c". */
function joinPt(items: string[]): string {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`
}
