import { AuthGuard } from '@/components/AuthGuard'
import { ServiceRequests } from '@/pages-impl/ServiceRequests'

export default function ServiceRequestsPage() {
  return <AuthGuard><ServiceRequests /></AuthGuard>
}
