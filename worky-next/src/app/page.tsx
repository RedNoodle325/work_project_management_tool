import { redirect } from 'next/navigation'

// The public entry point is the read-only employee schedule.
export default function Page() {
  redirect('/employee-scheduler')
}
