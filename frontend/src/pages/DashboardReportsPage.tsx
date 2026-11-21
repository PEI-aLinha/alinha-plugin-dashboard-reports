import type { ReactNode } from 'react'
import { Home, LayoutDashboard } from 'lucide-react'
import { EmptyState, PageHeader } from '@alinha/ui'

interface DashboardViewProps {
  title: string
  subtitle: string
  icon: ReactNode
  description: string
}

function DashboardView({ title, subtitle, icon, description }: DashboardViewProps) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <EmptyState icon={icon} title="Em construção">
        {description}
      </EmptyState>
    </>
  )
}

/** Client area home page (`/org/:org/dashboard`). */
export function ClientHomePage() {
  return (
    <DashboardView
      title="Início"
      subtitle="Resumo do estado de cibersegurança da sua organização."
      icon={<Home className="size-5" aria-hidden />}
      description="Aqui vai ver, num só sítio, o nível de preparação da sua organização, os próximos passos recomendados e os relatórios para partilhar."
    />
  )
}

/** Consultant overview of one client (`/portfolio/:org/dashboard`). */
export function ConsultantOverviewPage() {
  return (
    <DashboardView
      title="Visão geral"
      subtitle="Resumo do estado de cibersegurança desta organização."
      icon={<LayoutDashboard className="size-5" aria-hidden />}
      description="Aqui vai ver o ponto de situação desta organização cliente: avaliação, riscos principais, plano de ação e relatórios."
    />
  )
}
