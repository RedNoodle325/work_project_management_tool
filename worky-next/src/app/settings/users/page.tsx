import { AuthGuard } from '@/components/AuthGuard'
import { UserManagement } from '@/pages-impl/UserManagement'

export default function UserManagementPage() {
  return <AuthGuard><UserManagement /></AuthGuard>
}
