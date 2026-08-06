import { AuthGuard } from '@/components/AuthGuard'
import { XnrgyIssues } from '@/pages-impl/XnrgyIssues'

export default function Page() {
  return <AuthGuard><XnrgyIssues /></AuthGuard>
}
