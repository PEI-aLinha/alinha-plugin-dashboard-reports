package pt.alinha.dashboardreports

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class DashboardReportsPluginTest {
    @Test
    fun `manifest tem o id do plugin`() {
        assertEquals("dashboard-reports", DashboardReportsPlugin().manifest.id)
    }
}
