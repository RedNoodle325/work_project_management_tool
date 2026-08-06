import { AuthGuard } from '@/components/AuthGuard'
import { PrivateAuthGuard } from '@/components/PrivateAuthGuard'
import { TodoistTodos } from '@/pages-impl/TodoistTodos'

export default function Page() {
  return <AuthGuard><PrivateAuthGuard><TodoistTodos /></PrivateAuthGuard></AuthGuard>
}
