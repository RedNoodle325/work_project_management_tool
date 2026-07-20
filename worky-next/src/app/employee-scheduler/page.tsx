import { AuthGuard } from '@/components/AuthGuard'

export default function EmployeeSchedulerPage() {
  return (
    <AuthGuard>
      <main className="x-page x-scheduler-page">
        <iframe className="x-scheduler-frame" title="Employee Scheduler" src="/employee-scheduler.html" />
      </main>
    </AuthGuard>
  )
}
