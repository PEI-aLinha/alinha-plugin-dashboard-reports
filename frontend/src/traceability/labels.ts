import type { components } from '@alinha/api-client'

export type Traceability = components['schemas']['Traceability']
export type RequirementTrace = components['schemas']['RequirementTrace']
export type ControlTrace = components['schemas']['ControlTrace']
export type TraceEvidence = components['schemas']['TraceEvidence']

/** The only framework with a catalogue today; the page offers a choice once there are more. */
export const DEFAULT_FRAMEWORK = 'nis2-qnrcs'

export const LEVEL_LABEL: Record<string, string> = { basic: 'Básico', substantial: 'Substancial', high: 'Elevado' }

export const CONTROL_STATUS_LABEL: Record<NonNullable<ControlTrace['status']>, string> = {
  compliant: 'Cumpre',
  partial: 'Parcial',
  gap: 'Falha',
}

export const REQUIREMENT_STATUS_LABEL: Record<NonNullable<RequirementTrace['status']>, string> = {
  compliant: 'Cumpre',
  gap: 'Com falhas',
}

export const REASON_LABEL: Record<string, string> = {
  ANSWERED_NO: 'Respondeu que não',
  ANSWERED_UNKNOWN: 'Respondeu que não sabe',
  ANSWERED_PARTIAL: 'Respondeu que está em parte',
}

export const OUTCOME_LABEL: Record<TraceEvidence['outcome'], string> = {
  SATISFIED: 'Confirma o controlo',
  NOT_SATISFIED: 'Mostra uma falha',
}

export const STRENGTH_LABEL: Record<TraceEvidence['strength'], string> = {
  SELF_REPORTED: 'declarado pela organização',
  DOCUMENT_VERIFIED: 'documento verificado',
  TECHNICALLY_VERIFIED: 'verificado nos sistemas',
  CONTINUOUSLY_VERIFIED: 'verificado em contínuo',
}

/** A level or code we do not know yet is shown as it comes, never hidden. */
export const labelOf = (labels: Record<string, string>, value: string): string => labels[value] ?? value

export const traceabilityPath = (framework: string, onlyGaps: boolean): string =>
  `/dashboard-reports/traceability/${encodeURIComponent(framework)}${onlyGaps ? '?onlyGaps=true' : ''}`
