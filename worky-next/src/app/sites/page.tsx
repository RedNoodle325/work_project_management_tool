import { AuthGuard } from '@/components/AuthGuard'
import { XnrgySites } from '@/pages-impl/XnrgySites'

export default function Page() {
  return <AuthGuard><XnrgySites /></AuthGuard>
}
