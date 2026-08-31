import { AuthGuard } from '@/components/AuthGuard'
import { PartsOrders } from '@/pages-impl/PartsOrders'

export default function Page() {
  return <AuthGuard><PartsOrders /></AuthGuard>
}
