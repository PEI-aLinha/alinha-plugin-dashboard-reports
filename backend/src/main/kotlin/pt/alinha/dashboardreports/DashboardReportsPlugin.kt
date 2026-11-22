package pt.alinha.dashboardreports

import org.springframework.stereotype.Component
import pt.alinha.pluginapi.AlinhaPlugin
import pt.alinha.pluginapi.PluginKind
import pt.alinha.pluginapi.PluginManifest

/** Registers the plugin in the core's Module Registry. Keep in sync with plugin.yaml. */
@Component
class DashboardReportsPlugin : AlinhaPlugin {
    override val manifest = PluginManifest(
        id = "dashboard-reports",
        name = "Dashboard & Reports",
        kind = PluginKind.FEATURE,
        version = "0.1.0",
        publishes = setOf(),
        consumes = setOf(),
        permissions = setOf(PORTFOLIO_READ),
        // Only consultants have a portfolio: the client's people see their own organization's dashboard.
        rolePermissions = mapOf("consultant" to setOf(PORTFOLIO_READ)),
    )

    private companion object {
        /** The portfolio dashboard (#3): `GET /api/dashboard-reports/portfolio` and the `/portfolio/overview` page. */
        const val PORTFOLIO_READ = "portfolio:read"
    }
}
