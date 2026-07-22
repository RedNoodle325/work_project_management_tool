import { AuthGuard } from '@/components/AuthGuard'

export default function SchedulerProdPage() {
  return (
    <AuthGuard>
      <main className="x-page x-scheduler-page">
        <iframe className="x-scheduler-frame" title="Scheduler Prod" src="/scheduler-prod.html" />
      </main>
    </AuthGuard>
  )
}
