import Link from 'next/link'
import { ArrowRight, CalendarDays, LockKeyhole } from 'lucide-react'

export default function Page() {
  return (
    <main className="x-root-gateway">
      <header>
        <img src="/brand/xnrgy-mark.svg" alt="XNRGY" />
        <Link href="/login" className="x-root-login"><LockKeyhole size={16} />Login</Link>
      </header>
      <section>
        <span className="x-kicker">Zaktrack.pm</span>
        <h1>XNRGY field service program management</h1>
        <p>Open the shared employee scheduler in read-only mode, or sign in to manage the full PM tracking workspace.</p>
        <div className="x-root-actions">
          <Link href="/scheduler" className="x-root-primary"><CalendarDays size={20} />Open Scheduler<ArrowRight size={18} /></Link>
          <Link href="/login" className="x-root-secondary"><LockKeyhole size={16} />Login to Dashboard</Link>
        </div>
      </section>
    </main>
  )
}
