package pt.alinha.dashboardreports.internal.web

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/dashboard-reports")
class DashboardReportsController {

    /** Walking skeleton: proves the plugin is wired end to end. */
    @GetMapping("/ping")
    fun ping() = mapOf("plugin" to "dashboard-reports", "status" to "ok")
}
