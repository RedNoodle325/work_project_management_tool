import { AuthGuard } from '@/components/AuthGuard'
import { XnrgyDashboard } from '@/pages-impl/XnrgyDashboard'

export default function DashboardPage() {
  return <AuthGuard><XnrgyDashboard /></AuthGuard>
}
