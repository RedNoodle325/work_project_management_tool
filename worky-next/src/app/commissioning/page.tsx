import { AuthGuard } from '@/components/AuthGuard'
import { Commissioning } from '@/pages-impl/Commissioning'

export default function Page() {
  return <AuthGuard><Commissioning /></AuthGuard>
}
