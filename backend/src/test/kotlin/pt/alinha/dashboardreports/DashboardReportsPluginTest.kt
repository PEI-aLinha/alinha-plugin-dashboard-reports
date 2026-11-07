package pt.alinha.dashboardreports

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class DashboardReportsPluginTest {
    @Test
    fun `manifest has the plugin id`() {
        assertEquals("dashboard-reports", DashboardReportsPlugin().manifest.id)
    }
}
