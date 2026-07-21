'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

export function Login({ schedulerLogin = false }: { schedulerLogin?: boolean }) {
  const { login, setup } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [setupRequired, setSetupRequired] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    fetch('/api/auth/status')
      .then(response => response.ok ? response.json() : null)
      .then(status => setSetupRequired(Boolean(status?.setup_required)))
      .catch(() => setSetupRequired(false))
  }, [])

  async function submit(event: FormEvent) { event.preventDefault(); setError(''); setLoading(true); try { if (setupRequired) await setup(email, password, displayName); else await login(email, password) } catch (error) { setError(error instanceof Error ? error.message : 'Sign in failed') } finally { setLoading(false) } }
  const heading = setupRequired ? 'Create your owner account' : schedulerLogin ? 'Scheduler sign in' : 'Personal workspace login'
  const intro = setupRequired ? 'The first account owns the workspace and can create and manage user access.' : schedulerLogin ? 'Sign in to update employee schedules and assignments.' : 'Sign in with your owner, administrator, or project-management account.'
  return <main className="x-login"><section className="x-login-brand"><img src="/brand/xnrgy-mark.svg" alt="XNRGY" /><div><span>Shared workspace</span><h1>The details are the work.</h1><p>View the employee scheduler without signing in. Login unlocks only the tools assigned to your account.</p></div><small>Role-based editing</small></section><section className="x-login-form"><form onSubmit={submit}><span className="x-kicker">{setupRequired ? 'First-time setup' : schedulerLogin ? 'Scheduling' : 'Personal access'}</span><h2>{heading}</h2><p>{intro}</p>{setupRequired && <label><span>Your name</span><div><input required autoFocus value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Your name" /></div></label>}<label><span>Email address</span><div><Mail size={16} /><input type="email" required autoFocus={!setupRequired} value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" /></div></label><label><span>Password</span><div><LockKeyhole size={16} /><input type="password" required minLength={8} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" /></div></label>{error && <div className="x-error">{error}</div>}<button disabled={loading}>{loading ? (setupRequired ? 'Creating account…' : 'Signing in…') : (setupRequired ? 'Create owner account' : 'Sign in')}<ArrowRight size={16} /></button><Link href="/employee-scheduler" className="btn btn-secondary" style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>Back to read-only scheduler</Link></form></section></main>
}
