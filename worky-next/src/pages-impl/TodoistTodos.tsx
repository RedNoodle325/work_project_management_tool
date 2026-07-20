'use client'

import { FormEvent, useEffect, useState } from 'react'
import { Circle, Plus, RefreshCw } from 'lucide-react'
import { useToastFn } from '@/app/providers'
import { clearToken, getToken } from '@/api'

interface TodoistTask {
  id: string
  content: string
  description?: string
  priority: number
  due?: { date: string; string: string } | null
  labels?: string[]
}

interface TodoistProject {
  id: string
  name: string
}

async function todoistRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  if (!token) {
    window.location.assign('/login')
    throw new Error('Please sign in to view your personal to-do list')
  }
  const response = await fetch(`/api/todoist${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...options.headers },
  })
  if (response.status === 401) {
    clearToken()
    window.location.assign('/login')
    throw new Error('Your session expired. Please sign in again.')
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.error || 'Unable to reach Todoist')
  }
  return response.status === 204 ? undefined as T : response.json()
}

export function TodoistTodos() {
  const toast = useToastFn()
  const [tasks, setTasks] = useState<TodoistTask[]>([])
  const [projects, setProjects] = useState<TodoistProject[]>([])
  const [projectId, setProjectId] = useState('')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [taskData, projectData] = await Promise.all([
        todoistRequest<TodoistTask[]>('/tasks'),
        todoistRequest<TodoistProject[]>('/projects'),
      ])
      setTasks(taskData)
      setProjects(projectData.sort((a, b) => a.name.localeCompare(b.name)))
    }
    catch (error) { toast(error instanceof Error ? error.message : 'Unable to load tasks', 'error') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  async function addTask(event: FormEvent) {
    event.preventDefault()
    if (!text.trim()) return
    setSaving(true)
    try {
      const task = await todoistRequest<TodoistTask>('/tasks', { method: 'POST', body: JSON.stringify({ content: text, project_id: projectId || undefined }) })
      setTasks(current => [task, ...current])
      setText('')
    } catch (error) { toast(error instanceof Error ? error.message : 'Unable to add task', 'error') }
    finally { setSaving(false) }
  }

  async function completeTask(id: string) {
    const original = tasks
    setTasks(current => current.filter(task => task.id !== id))
    try { await todoistRequest(`/tasks/${id}/complete`, { method: 'POST' }) }
    catch (error) { setTasks(original); toast(error instanceof Error ? error.message : 'Unable to complete task', 'error') }
  }

  return <div>
    <div className="page-header" style={{ marginBottom: 20 }}>
      <div><h1 style={{ margin: 0 }}>My To-Do List</h1><div className="page-subtitle">Private tasks synced with Todoist</div></div>
      <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}><RefreshCw size={14} /> Refresh</button>
    </div>
    <form onSubmit={addTask} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(220px, 0.45fr) auto', gap: 8, marginBottom: 18 }}>
      <input value={text} onChange={event => setText(event.target.value)} placeholder="Add a task to Todoist…" aria-label="New task" />
      <select value={projectId} onChange={event => setProjectId(event.target.value)} aria-label="Todoist project">
        <option value="">Inbox (no project)</option>
        {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
      </select>
      <button className="btn btn-primary" disabled={saving || !text.trim()}><Plus size={16} /> {saving ? 'Adding…' : 'Add task'}</button>
    </form>
    {loading ? <div style={{ color: 'var(--text3)', padding: 32, textAlign: 'center' }}>Loading your tasks…</div> : tasks.length === 0 ? <div style={{ color: 'var(--text3)', padding: 32, textAlign: 'center' }}>Nothing left to do.</div> : <div>
      {tasks.map(task => <div key={task.id} style={{ display: 'flex', gap: 12, padding: '13px 14px', marginBottom: 8, border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg2)' }}>
        <button onClick={() => completeTask(task.id)} aria-label={`Complete ${task.content}`} style={{ border: 0, background: 'transparent', color: 'var(--text3)', cursor: 'pointer', padding: 1 }}><Circle size={19} /></button>
        <div style={{ flex: 1 }}><div style={{ fontWeight: 600 }}>{task.content}</div>{task.description && <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text2)' }}>{task.description}</div>}<div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 11, color: 'var(--text3)' }}>{task.due && <span>Due {task.due.string || task.due.date}</span>}{task.labels?.map(label => <span key={label}>#{label}</span>)}</div></div>
        {task.priority < 4 && <span style={{ fontSize: 11, color: task.priority === 1 ? 'var(--red)' : 'var(--accent)' }}>P{5 - task.priority}</span>}
      </div>)}
    </div>}
  </div>
}
