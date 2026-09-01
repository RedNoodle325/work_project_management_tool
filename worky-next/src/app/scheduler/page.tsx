import { AuthGuard } from '@/components/AuthGuard'
import { Scheduler } from '@/pages-impl/Scheduler'

export default function SchedulerPage() {
  return <AuthGuard><Scheduler /></AuthGuard>
}
