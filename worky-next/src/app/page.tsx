import Link from 'next/link'
import { CalendarDays, LockKeyhole } from 'lucide-react'

export default function Page() {
  return (
    <main className="x-landing">
      <header>
        <Link href="/" className="x-landing-brand">
          <img src="/brand/xnrgy-mark.svg" alt="XNRGY" />
          <span>Zaktrack.pm</span>
        </Link>
        <Link href="/login" className="x-landing-login"><LockKeyhole size={16} /> Login</Link>
      </header>

      <section>
        <span className="x-kicker">XNRGY Program Management</span>
        <h1>Field service work, pointed in the right direction.</h1>
        <p>
          Open the public scheduler for read-only staffing visibility, or sign in to manage the full project tracking dashboard.
        </p>
        <div>
          <Link href="/scheduler" className="x-landing-primary"><CalendarDays size={20} /> Open Scheduler</Link>
          <Link href="/login" className="x-landing-secondary"><LockKeyhole size={18} /> Login</Link>
        </div>
      </section>
    </main>
  )
}
