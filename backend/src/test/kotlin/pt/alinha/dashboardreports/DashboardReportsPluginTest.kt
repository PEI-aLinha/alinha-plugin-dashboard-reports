package pt.alinha.dashboardreports

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import java.io.File

class DashboardReportsPluginTest {
    private val manifest = DashboardReportsPlugin().manifest

    @Test
    fun `manifest has the plugin id`() {
        assertEquals("dashboard-reports", manifest.id)
    }

    @Test
    fun `only consultants may read the portfolio and the traceability view`() {
        assertEquals(setOf("portfolio:read", "traceability:read"), manifest.permissions)
        assertEquals(mapOf("consultant" to setOf("portfolio:read", "traceability:read")), manifest.rolePermissions)
    }

    @Test
    fun `plugin yaml lists the same permissions as the manifest`() {
        val pluginYaml = File("../plugin.yaml").readText()
        manifest.permissions.forEach { assertEquals(true, pluginYaml.contains("- $it"), "plugin.yaml is missing $it") }
    }
}
