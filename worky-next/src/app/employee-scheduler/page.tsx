import { AuthGuard } from '@/components/AuthGuard'

export default function EmployeeSchedulerPage() {
  return (
    <AuthGuard>
      <main className="x-page x-scheduler-page">
        <header className="x-directory-head">
          <div>
            <span className="x-kicker">Operations planning</span>
            <h1>Employee Scheduler</h1>
            <p>Plan weekly assignments, travel, and time off for the whole team.</p>
          </div>
        </header>
        <iframe className="x-scheduler-frame" title="Employee Scheduler" src="/employee-scheduler.html" />
      </main>
    </AuthGuard>
  )
}
