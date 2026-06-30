import { AuthGuard } from '@/components/AuthGuard'
import { XnrgyDashboard } from '@/pages-impl/XnrgyDashboard'

export default function Page() {
  return <AuthGuard><XnrgyDashboard /></AuthGuard>
}
