import { AuthGuard } from '@/components/AuthGuard'
import { Jobs } from '@/pages-impl/Jobs'

export default function JobsPage() {
  return <AuthGuard><Jobs /></AuthGuard>
}
