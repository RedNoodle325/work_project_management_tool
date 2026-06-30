import { AuthGuard } from '@/components/AuthGuard'
import { XnrgySiteWorkspace } from '@/pages-impl/XnrgySiteWorkspace'

export default function Page() {
  return <AuthGuard><XnrgySiteWorkspace /></AuthGuard>
}
