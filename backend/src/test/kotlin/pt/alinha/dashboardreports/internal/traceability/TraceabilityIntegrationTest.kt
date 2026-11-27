package pt.alinha.dashboardreports.internal.traceability

import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.get
import pt.alinha.core.tenant.TenantContext
import java.util.UUID

private const val TRACE = "/api/dashboard-reports/traceability/nis2-qnrcs"

@SpringBootTest(classes = [TraceabilityTestApplication::class])
@AutoConfigureMockMvc
class TraceabilityIntegrationTest {
    companion object {
        @DynamicPropertySource
        @JvmStatic
        fun properties(registry: DynamicPropertyRegistry) = TraceabilityDatabase.register(registry)
    }

    @Autowired private lateinit var mvc: MockMvc
    @Autowired private lateinit var results: FakeControlResults
    @Autowired private lateinit var tenants: TenantContext

    private val client = UUID.randomUUID()
    private val other = UUID.randomUUID()

    @BeforeEach
    fun evaluatedClient() {
        results.context = tenants
        results.byTenant[client] = EvaluatedControls(1, "controls-2026.11-v1", mapOf("CTRL-B" to ControlOutcome("gap", "ANSWERED_NO")))
    }

    private fun asConsultant(path: String, tenant: UUID = client) = mvc.get(path) {
        header("Authorization", "Bearer consultant.${UUID.randomUUID()}.$tenant")
        header("X-Alinha-Tenant", tenant)
    }

    @Test
    fun `the consultant sees the client's gaps under each requirement`() {
        asConsultant(TRACE).andExpect {
            status { isOk() }
            jsonPath("$.evaluated") { value(true) }
            jsonPath("$.catalogueVersion") { value(1) }
            jsonPath("$.requirements[0].id") { value("REQ-1") }
            jsonPath("$.requirements[0].status") { value("gap") }
            jsonPath("$.requirements[0].controls[1].reason") { value("ANSWERED_NO") }
        }
    }

    @Test
    fun `another client of the same consultant has its own results`() {
        asConsultant(TRACE, tenant = other).andExpect {
            status { isOk() }
            jsonPath("$.evaluated") { value(false) }
            jsonPath("$.requirements[0].status") { doesNotExist() }
        }
    }

    @Test
    fun `only gaps and one requirement`() {
        asConsultant("$TRACE?onlyGaps=true").andExpect { jsonPath("$.requirements.length()") { value(2) } }
        asConsultant("$TRACE/requirements/REQ-2").andExpect {
            status { isOk() }
            jsonPath("$.controls[0].id") { value("CTRL-B") }
        }
    }

    @Test
    fun `the client's own people cannot open the consultant's view`() {
        for (role in listOf("responsible", "analyst")) {
            mvc.get(TRACE) { header("Authorization", "Bearer $role.${UUID.randomUUID()}.$client") }
                .andExpect { status { isForbidden() } }
        }
    }

    @Test
    fun `a consultant must name the client, and only an assigned one`() {
        mvc.get(TRACE) { header("Authorization", "Bearer consultant.${UUID.randomUUID()}.$client") }
            .andExpect { status { isBadRequest() } }
        mvc.get(TRACE) {
            header("Authorization", "Bearer consultant.${UUID.randomUUID()}.$client")
            header("X-Alinha-Tenant", other)
        }.andExpect { status { isForbidden() } }
    }

    @Test
    fun `an unknown framework or requirement is a 404 with its code`() {
        asConsultant("/api/dashboard-reports/traceability/gdpr").andExpect {
            status { isNotFound() }
            jsonPath("$.code") { value("FRAMEWORK_NOT_FOUND") }
        }
        asConsultant("$TRACE/requirements/REQ-9").andExpect {
            status { isNotFound() }
            jsonPath("$.code") { value("REQUIREMENT_NOT_FOUND") }
        }
    }
}
