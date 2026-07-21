'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export function Login() {
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
  return <main className="x-login"><section className="x-login-brand"><img src="/brand/xnrgy-mark.svg" alt="XNRGY" /><div><span>Shared workspace</span><h1>The details are the work.</h1><p>Visitors can browse the tracker. Sign in to use the features assigned to your role.</p></div><small>Role-based editing</small></section><section className="x-login-form"><form onSubmit={submit}><span className="x-kicker">{setupRequired ? 'First-time setup' : 'Welcome back'}</span><h2>{setupRequired ? 'Create your owner account' : 'Sign in to edit'}</h2><p>{setupRequired ? 'The first account owns the workspace and can create and manage user access.' : 'Your role determines which workspace actions you can take.'}</p>{setupRequired && <label><span>Your name</span><div><input required autoFocus value={displayName} onChange={event => setDisplayName(event.target.value)} placeholder="Your name" /></div></label>}<label><span>Email address</span><div><Mail size={16} /><input type="email" required autoFocus={!setupRequired} value={email} onChange={event => setEmail(event.target.value)} placeholder="you@company.com" /></div></label><label><span>Password</span><div><LockKeyhole size={16} /><input type="password" required minLength={8} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" /></div></label>{error && <div className="x-error">{error}</div>}<button disabled={loading}>{loading ? (setupRequired ? 'Creating account…' : 'Signing in…') : (setupRequired ? 'Create owner account' : 'Sign in')}<ArrowRight size={16} /></button></form></section></main>
}
