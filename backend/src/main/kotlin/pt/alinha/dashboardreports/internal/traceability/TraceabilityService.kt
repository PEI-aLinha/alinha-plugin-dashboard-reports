package pt.alinha.dashboardreports.internal.traceability

import org.springframework.beans.factory.ObjectProvider
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.stereotype.Service
import pt.alinha.core.compliance.Catalogue
import pt.alinha.core.compliance.CatalogueRegistry

class FrameworkNotFoundException : RuntimeException("No catalogue for this framework")
class RequirementNotFoundException : RuntimeException("No such requirement in the catalogue")

/** `Traceability` in the contract. */
data class TraceabilityView(
    val framework: String,
    val catalogueVersion: Int,
    val catalogueTitle: String,
    /** Null until the organization's assessment has been evaluated. */
    val engineVersion: String?,
    val evaluated: Boolean,
    val requirements: List<RequirementTrace>,
)

data class RequirementTrace(
    val id: String,
    val reference: String,
    val text: String,
    /** compliant, gap (some control is a gap or partial) or null (not evaluated, or no control evaluated). */
    val status: String?,
    val controls: List<ControlTrace>,
)

data class ControlTrace(
    val id: String,
    val title: String,
    val level: String,
    val status: String?,
    val reason: String?,
    val actions: List<ActionRef>,
    val evidence: List<EvidenceRef>,
)

/**
 * Requirement -> controls -> gaps -> roadmap actions -> evidence, for the consultant (alinha#26, FR38, FR39, US39).
 * The requirements and their controls come from the catalogue version the evaluation used (RNF18), or the newest
 * one before any evaluation. The status of a control is the Compliance Engine's, never computed here (RNF05).
 */
@Service
class TraceabilityService(
    private val catalogues: CatalogueRegistry,
    private val results: ControlResults,
    private val actions: RoadmapActions,
    private val evidence: EvidenceIndex,
) {
    /** Each source is optional: with no bean for it yet, it reads as "nothing yet" (see TraceabilitySources.kt). */
    @Autowired
    constructor(
        catalogues: CatalogueRegistry,
        results: ObjectProvider<ControlResults>,
        actions: ObjectProvider<RoadmapActions>,
        evidence: ObjectProvider<EvidenceIndex>,
    ) : this(
        catalogues,
        results.getIfAvailable { NO_RESULTS },
        actions.getIfAvailable { NO_ACTIONS },
        evidence.getIfAvailable { NO_EVIDENCE },
    )

    fun trace(framework: String, onlyGaps: Boolean = false): TraceabilityView {
        val evaluated = results.latest(framework)
        val catalogue = catalogueFor(framework, evaluated)
        val actionsByControl = actions.byControl(framework)
        val evidenceByControl = evidence.byControl()
        val controls = catalogue.controls.associateBy { it.id }
        val requirements = catalogue.requirements.map { requirement ->
            val traced = requirement.controls.mapNotNull { controls[it] }.map { control ->
                val outcome = evaluated?.controls?.get(control.id)
                ControlTrace(
                    id = control.id,
                    title = control.title,
                    level = levelId(control.level),
                    status = outcome?.status,
                    reason = outcome?.reason,
                    actions = actionsByControl[control.id].orEmpty(),
                    evidence = evidenceByControl[control.id].orEmpty(),
                )
            }
            RequirementTrace(requirement.id, requirement.reference, requirement.text, statusOf(traced), traced)
        }
        return TraceabilityView(
            framework = catalogue.framework,
            catalogueVersion = catalogue.version,
            catalogueTitle = catalogue.title,
            engineVersion = evaluated?.engineVersion,
            evaluated = evaluated != null,
            requirements = if (onlyGaps) requirements.filter { it.status == GAP } else requirements,
        )
    }

    fun requirement(framework: String, requirementId: String): RequirementTrace =
        trace(framework).requirements.firstOrNull { it.id == requirementId } ?: throw RequirementNotFoundException()

    private fun catalogueFor(framework: String, evaluated: EvaluatedControls?): Catalogue =
        (evaluated?.let { catalogues.get(framework, it.catalogueVersion) } ?: catalogues.latest(framework))
            ?: throw FrameworkNotFoundException()

    /** Not evaluated: null. Any control that is a gap or partial makes the requirement a gap. */
    private fun statusOf(controls: List<ControlTrace>): String? {
        val evaluated = controls.mapNotNull { it.status }
        return when {
            evaluated.isEmpty() -> null
            evaluated.any { it != COMPLIANT } -> GAP
            evaluated.size == controls.size -> COMPLIANT
            else -> null // some controls compliant, the others not evaluated (above the target level)
        }
    }

    private companion object {
        const val COMPLIANT = "compliant"
        const val GAP = "gap"

        /**
         * The level id as the contract sends it. Works for the current enum (`BASIC` -> `basic`) and for the level ids
         * of catalogue-defined scales (PEI-aLinha/alinha#179), so this code survives that change unedited.
         */
        fun levelId(level: Any): String = level.toString().lowercase()
    }
}
