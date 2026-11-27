package pt.alinha.dashboardreports.internal.traceability

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.context.ApplicationEventPublisher
import org.springframework.core.io.ClassPathResource
import org.springframework.transaction.support.TransactionOperations
import pt.alinha.core.compliance.CatalogueRegistry
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

private const val FRAMEWORK = "nis2-qnrcs"

class TraceabilityServiceTest {
    private val catalogues = CatalogueRegistry(
        ClassPathResource("frameworks").file.absolutePath,
        ApplicationEventPublisher { },
        TransactionOperations.withoutTransaction(),
    ).apply { onStartup() }

    private fun service(
        results: ControlResults = NO_RESULTS,
        actions: RoadmapActions = NO_ACTIONS,
        evidence: EvidenceIndex = NO_EVIDENCE,
    ) = TraceabilityService(catalogues, results, actions, evidence)

    /** Evaluated on v1 up to substantial: CTRL-A compliant, CTRL-B a gap (answered no), CTRL-C not evaluated. */
    private val evaluatedOnV1 = ControlResults {
        EvaluatedControls(
            catalogueVersion = 1,
            engineVersion = "controls-2026.11-v1",
            controls = mapOf(
                "CTRL-A" to ControlOutcome("compliant", null),
                "CTRL-B" to ControlOutcome("gap", "ANSWERED_NO"),
            ),
        )
    }

    @Test
    fun `before any evaluation it lists the newest catalogue, with no status`() {
        val view = service().trace(FRAMEWORK)

        assertThat(view.evaluated).isFalse()
        assertThat(view.catalogueVersion).isEqualTo(2)
        assertThat(view.engineVersion).isNull()
        assertThat(view.requirements.map { it.id }).containsExactly("REQ-1", "REQ-2")
        assertThat(view.requirements.flatMap { it.controls }.map { it.status }).containsOnlyNulls()
    }

    @Test
    fun `an evaluation keeps the catalogue version it was made with, not the newest`() {
        val view = service(evaluatedOnV1).trace(FRAMEWORK)

        assertThat(view.catalogueVersion).isEqualTo(1)
        assertThat(view.requirements.single { it.id == "REQ-2" }.text).isEqualTo("As cópias de segurança são testadas.")
        assertThat(view.engineVersion).isEqualTo("controls-2026.11-v1")
    }

    @Test
    fun `a gap in a shared control shows under every requirement that points to it`() {
        val view = service(evaluatedOnV1).trace(FRAMEWORK)

        val ctrlB = view.requirements.map { r -> r.controls.single { it.id == "CTRL-B" } }
        assertThat(ctrlB).hasSize(2).allSatisfy {
            assertThat(it.status).isEqualTo("gap")
            assertThat(it.reason).isEqualTo("ANSWERED_NO")
            assertThat(it.level).isEqualTo("substantial")
        }
        assertThat(view.requirements.map { it.status }).containsExactly("gap", "gap")
    }

    @Test
    fun `a requirement is compliant only when every control is, and has no status when some were not evaluated`() {
        val allCompliant = ControlResults {
            EvaluatedControls(1, "v", mapOf("CTRL-A" to ControlOutcome("compliant", null), "CTRL-B" to ControlOutcome("compliant", null)))
        }

        val view = service(allCompliant).trace(FRAMEWORK)

        assertThat(view.requirements.single { it.id == "REQ-1" }.status).isEqualTo("compliant")
        // REQ-2's CTRL-C is above the evaluated level: neither compliant nor a gap.
        assertThat(view.requirements.single { it.id == "REQ-2" }.status).isNull()
    }

    @Test
    fun `a partial control makes its requirement a gap`() {
        val partial = ControlResults {
            EvaluatedControls(1, "v", mapOf("CTRL-A" to ControlOutcome("partial", "ANSWERED_PARTIAL"), "CTRL-B" to ControlOutcome("compliant", null)))
        }

        assertThat(service(partial).trace(FRAMEWORK).requirements.single { it.id == "REQ-1" }.status).isEqualTo("gap")
    }

    @Test
    fun `only gaps leaves out the requirements without one`() {
        val onlyA = ControlResults {
            EvaluatedControls(1, "v", mapOf("CTRL-A" to ControlOutcome("gap", "ANSWERED_UNKNOWN"), "CTRL-B" to ControlOutcome("compliant", null)))
        }

        val view = service(onlyA).trace(FRAMEWORK, onlyGaps = true)

        assertThat(view.requirements.map { it.id }).containsExactly("REQ-1")
    }

    @Test
    fun `roadmap actions and evidence are attached to their control`() {
        val action = ActionRef(UUID.randomUUID(), "Ativar a autenticação multifator", "open", LocalDate.of(2026, 12, 15))
        val proof = EvidenceRef("code-repository", UUID.randomUUID(), "NOT_SATISFIED", "TECHNICALLY_VERIFIED", Instant.EPOCH)

        val view = service(
            evaluatedOnV1,
            actions = { mapOf("CTRL-B" to listOf(action)) },
            evidence = { mapOf("CTRL-B" to listOf(proof)) },
        ).trace(FRAMEWORK)

        val ctrlB = view.requirements.first().controls.single { it.id == "CTRL-B" }
        assertThat(ctrlB.actions).containsExactly(action)
        assertThat(ctrlB.evidence).containsExactly(proof)
        assertThat(view.requirements.first().controls.single { it.id == "CTRL-A" }.actions).isEmpty()
    }

    @Test
    fun `one requirement can be read on its own`() {
        assertThat(service(evaluatedOnV1).requirement(FRAMEWORK, "REQ-2").controls.map { it.id }).containsExactly("CTRL-B", "CTRL-C")
    }

    @Test
    fun `an unknown framework or requirement is not found`() {
        assertThrows<FrameworkNotFoundException> { service().trace("gdpr") }
        assertThrows<RequirementNotFoundException> { service().requirement(FRAMEWORK, "REQ-9") }
    }
}
