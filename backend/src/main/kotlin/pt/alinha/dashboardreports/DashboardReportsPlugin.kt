package pt.alinha.dashboardreports

import org.springframework.stereotype.Component
import pt.alinha.pluginapi.AlinhaPlugin
import pt.alinha.pluginapi.PluginKind
import pt.alinha.pluginapi.PluginManifest

/** Registo do plugin no Module Registry do Core. Manter igual ao plugin.yaml. */
@Component
class DashboardReportsPlugin : AlinhaPlugin {
    override val manifest = PluginManifest(
        id = "dashboard-reports",
        name = "Dashboard & Reports",
        kind = PluginKind.FEATURE,
        version = "0.1.0",
        publishes = setOf(),
        consumes = setOf(),
        permissions = setOf(),
    )
}
