package pt.alinha.dashboardreports.internal.web

import org.springframework.http.HttpStatus
import org.springframework.http.ProblemDetail
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.bind.annotation.RestControllerAdvice
import pt.alinha.core.access.RequiresPermission
import pt.alinha.dashboardreports.internal.traceability.FrameworkNotFoundException
import pt.alinha.dashboardreports.internal.traceability.RequirementNotFoundException
import pt.alinha.dashboardreports.internal.traceability.RequirementTrace
import pt.alinha.dashboardreports.internal.traceability.TraceabilityService
import pt.alinha.dashboardreports.internal.traceability.TraceabilityView

/** The consultant's traceability view of one client (alinha#26): `/portfolio/:org/traceability`. */
@RestController
@RequestMapping("/api/dashboard-reports/traceability/{framework}")
class TraceabilityController(private val traceability: TraceabilityService) {

    @RequiresPermission("traceability", "read")
    @GetMapping
    fun trace(@PathVariable framework: String, @RequestParam(defaultValue = "false") onlyGaps: Boolean): TraceabilityView =
        traceability.trace(framework, onlyGaps)

    @RequiresPermission("traceability", "read")
    @GetMapping("/requirements/{requirementId}")
    fun requirement(@PathVariable framework: String, @PathVariable requirementId: String): RequirementTrace =
        traceability.requirement(framework, requirementId)
}

/** RFC 9457 Problem Details with `code` (ADR 0003); `detail` in Portuguese. */
@RestControllerAdvice(basePackageClasses = [TraceabilityController::class])
class TraceabilityProblems {
    @ExceptionHandler
    fun framework(e: FrameworkNotFoundException) =
        problem("FRAMEWORK_NOT_FOUND", "Este referencial ainda não está disponível na plataforma.")

    @ExceptionHandler
    fun requirement(e: RequirementNotFoundException) =
        problem("REQUIREMENT_NOT_FOUND", "Este requisito não existe nesta versão do referencial.")

    private fun problem(code: String, detail: String) =
        ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, detail).apply { setProperty("code", code) }
}
