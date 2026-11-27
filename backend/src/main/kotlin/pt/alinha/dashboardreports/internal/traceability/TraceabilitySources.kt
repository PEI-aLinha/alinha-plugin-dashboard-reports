package pt.alinha.dashboardreports.internal.traceability

import java.time.Instant
import java.time.LocalDate
import java.util.UUID

/*
 * Where the traceability view (alinha#26) reads from. Each source answers for the CURRENT tenant only
 * (TenantContext), never for a tenant passed in. Until the real sources exist, the defaults below say "nothing yet",
 * and the page shows that the data is still to come:
 *   - control results: the core's EvaluationResults (PEI-aLinha/alinha#177), implemented by assessment (assessment#27)
 *   - roadmap actions: the assessment plugin's `api` (assessment#6)
 *   - evidence: this plugin's read model of EvidenceCollected (dashboard-reports#2)
 * A real implementation is a bean of the same interface: TraceabilityService takes it when there is one.
 */

/** The result of the latest evaluation, per control. */
data class EvaluatedControls(
    val catalogueVersion: Int,
    val engineVersion: String,
    /** Control id -> its result. A control the evaluation did not cover (above the target level) is absent. */
    val controls: Map<String, ControlOutcome>,
)

/** `status`: compliant, partial or gap. `reason` (why it is a gap) is null when compliant or unknown. */
data class ControlOutcome(val status: String, val reason: String?)

data class ActionRef(val id: UUID, val title: String, val status: String, val dueDate: LocalDate?)

data class EvidenceRef(
    val provider: String,
    val evidenceId: UUID,
    /** SATISFIED supports the control; NOT_SATISFIED shows a gap (a failed check is evidence too). */
    val outcome: String,
    val strength: String,
    val collectedAt: Instant,
)

fun interface ControlResults {
    /** The latest evaluation of [framework], or null when there is none yet. */
    fun latest(framework: String): EvaluatedControls?
}

fun interface RoadmapActions {
    /** The roadmap actions of [framework], by control id. Empty when there is no roadmap yet. */
    fun byControl(framework: String): Map<String, List<ActionRef>>
}

fun interface EvidenceIndex {
    /** The collected evidence, by control id. Empty when nothing was collected. */
    fun byControl(): Map<String, List<EvidenceRef>>
}

/** "Nothing yet", for every source with no real implementation in the application. */
internal val NO_RESULTS = ControlResults { null }
internal val NO_ACTIONS = RoadmapActions { emptyMap() }
internal val NO_EVIDENCE = EvidenceIndex { emptyMap() }
