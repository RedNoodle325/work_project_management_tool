'use client'

import { useState, type FormEvent } from 'react'
import { ArrowRight, LockKeyhole, Mail } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  async function submit(event: FormEvent) { event.preventDefault(); setError(''); setLoading(true); try { await login(email, password) } catch (error) { setError(error instanceof Error ? error.message : 'Sign in failed') } finally { setLoading(false) } }
  return <main className="x-login"><section className="x-login-brand"><img src="/brand/xnrgy-mark.svg" alt="XNRGY" /><div><span>Site intelligence</span><h1>The details are the work.</h1><p>Notes, equipment history, field issues, contacts, and the complete project paper trail—organized by the sites they belong to.</p></div><small>XNRGY Climate Systems · Internal workspace</small></section><section className="x-login-form"><form onSubmit={submit}><span className="x-kicker">Welcome back</span><h2>Sign in to your workspace</h2><p>Use your project tracker account.</p><label><span>Email address</span><div><Mail size={16} /><input type="email" required autoFocus value={email} onChange={event => setEmail(event.target.value)} placeholder="you@xnrgy.com" /></div></label><label><span>Password</span><div><LockKeyhole size={16} /><input type="password" required value={password} onChange={event => setPassword(event.target.value)} placeholder="Enter your password" /></div></label>{error && <div className="x-error">{error}</div>}<button disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}<ArrowRight size={16} /></button></form></section></main>
}
