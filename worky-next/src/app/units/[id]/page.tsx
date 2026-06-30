import { AuthGuard } from '@/components/AuthGuard'
import { XnrgyUnitWorkspace } from '@/pages-impl/XnrgyUnitWorkspace'

export default function Page() {
  return <AuthGuard><XnrgyUnitWorkspace /></AuthGuard>
}
