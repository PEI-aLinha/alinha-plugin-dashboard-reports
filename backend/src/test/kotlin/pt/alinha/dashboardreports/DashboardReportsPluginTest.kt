package pt.alinha.dashboardreports

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class DashboardReportsPluginTest {
    @Test
    fun `manifest has the plugin id`() {
        assertEquals("dashboard-reports", DashboardReportsPlugin().manifest.id)
    }

    @Test
    fun `only consultants may read the portfolio`() {
        val manifest = DashboardReportsPlugin().manifest
        assertEquals(setOf("portfolio:read"), manifest.permissions)
        assertEquals(mapOf("consultant" to setOf("portfolio:read")), manifest.rolePermissions)
    }
}
