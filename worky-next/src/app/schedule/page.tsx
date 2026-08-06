import { AuthGuard } from '@/components/AuthGuard'
import { Schedule } from '@/pages-impl/Schedule'

export default function Page() {
  return <AuthGuard><Schedule /></AuthGuard>
}
