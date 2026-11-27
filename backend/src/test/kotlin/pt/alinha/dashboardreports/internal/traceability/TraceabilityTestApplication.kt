package pt.alinha.dashboardreports.internal.traceability

import org.springframework.boot.SpringBootConfiguration
import org.springframework.boot.autoconfigure.EnableAutoConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.annotation.Primary
import org.springframework.core.io.ClassPathResource
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.test.context.DynamicPropertyRegistry
import org.testcontainers.postgresql.PostgreSQLContainer
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import pt.alinha.core.access.internal.AccessWebConfig
import pt.alinha.core.access.internal.RequiresPermissionInterceptor
import pt.alinha.core.access.internal.RolePermissionRegistry
import pt.alinha.core.access.internal.SecurityConfig
import pt.alinha.core.compliance.CatalogueRegistry
import pt.alinha.core.registry.PluginRegistry
import pt.alinha.core.tenant.TenantContext
import pt.alinha.core.tenant.internal.CorrelationIdFilter
import pt.alinha.core.tenant.internal.HibernateTenantResolver
import pt.alinha.core.tenant.internal.JwtTenantContext
import pt.alinha.core.tenant.internal.ScopedCorrelationContext
import pt.alinha.core.tenant.internal.TenantResolutionInterceptor
import pt.alinha.core.tenant.internal.TenantWebConfig
import pt.alinha.dashboardreports.DashboardReportsPlugin
import pt.alinha.dashboardreports.internal.web.TraceabilityController
import pt.alinha.dashboardreports.internal.web.TraceabilityProblems

/**
 * The traceability endpoints with the core's real RBAC and tenant resolution; only the JWT decoder is a fake, and
 * the control results are [FakeControlResults]. Token value: `<role>.<sub>.<tenant>`.
 */
@SpringBootConfiguration
@EnableAutoConfiguration
@Import(
    SecurityConfig::class, AccessWebConfig::class, RequiresPermissionInterceptor::class,
    RolePermissionRegistry::class, PluginRegistry::class,
    TenantWebConfig::class, TenantResolutionInterceptor::class, JwtTenantContext::class,
    HibernateTenantResolver::class, CorrelationIdFilter::class, ScopedCorrelationContext::class,
    CatalogueRegistry::class,
    DashboardReportsPlugin::class, TraceabilityService::class, TraceabilityController::class, TraceabilityProblems::class,
)
class TraceabilityTestApplication {
    @Bean
    fun controlResults() = FakeControlResults()

    @Bean
    @Primary
    fun testJwtDecoder(): JwtDecoder = JwtDecoder { token ->
        val (role, sub, tenant) = (token.split(".") + listOf("", "")).take(3)
        val builder = Jwt.withTokenValue(token).header("alg", "none").subject(sub).claim("email_verified", true)
            .claim("realm_access", mapOf("roles" to listOf(role)))
        when {
            tenant.isEmpty() -> Unit
            role == "consultant" -> builder.claim("tenants", listOf(tenant))
            else -> builder.claim("tenant_id", tenant)
        }
        builder.build()
    }
}

/** Answers per tenant, as the real source must: the tenant comes from the request, never from the caller. */
class FakeControlResults : ControlResults {
    val byTenant: MutableMap<UUID, EvaluatedControls> = ConcurrentHashMap()
    lateinit var context: TenantContext

    override fun latest(framework: String): EvaluatedControls? = byTenant[context.current().value]
}

object TraceabilityDatabase {
    val postgres: PostgreSQLContainer = PostgreSQLContainer("postgres:17").apply { start() }

    fun register(registry: DynamicPropertyRegistry) {
        registry.add("spring.datasource.url", postgres::getJdbcUrl)
        registry.add("spring.datasource.username", postgres::getUsername)
        registry.add("spring.datasource.password", postgres::getPassword)
        registry.add("spring.jpa.open-in-view") { "false" }
        registry.add("spring.flyway.locations") { "classpath:db/migration" }
        registry.add("spring.security.oauth2.resourceserver.jwt.issuer-uri") { "https://keycloak.test/realms/alinha" }
        registry.add("spring.security.oauth2.resourceserver.jwt.audiences") { "alinha-api" }
        registry.add("alinha.frameworks.dir") { ClassPathResource("frameworks").file.absolutePath }
    }
}
