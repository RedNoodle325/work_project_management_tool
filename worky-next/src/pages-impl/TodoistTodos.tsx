'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarClock, CheckCircle2, Circle, FolderKanban, Inbox, ListTodo, Plus, RefreshCw, Tag, TriangleAlert } from 'lucide-react'
import { useToastFn } from '@/app/providers'

interface TodoistTask {
  id: string
  content: string
  description?: string
  project_id?: string | null
  priority: number
  due?: { date: string; string: string } | null
  labels?: string[]
}

interface TodoistProject {
  id: string
  name: string
}

interface ProjectGroup {
  id: string
  name: string
  inbox: boolean
  tasks: TodoistTask[]
}

async function todoistRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/todoist${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.error || 'Unable to reach Todoist')
  }
  return response.status === 204 ? undefined as T : response.json()
}

function localDateKey() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function sortTasks(left: TodoistTask, right: TodoistTask) {
  const leftDue = left.due?.date || '9999-12-31'
  const rightDue = right.due?.date || '9999-12-31'
  return leftDue.localeCompare(rightDue) || right.priority - left.priority || left.content.localeCompare(right.content)
}

export function TodoistTodos() {
  const toast = useToastFn()
  const [tasks, setTasks] = useState<TodoistTask[]>([])
  const [projects, setProjects] = useState<TodoistProject[]>([])
  const [projectId, setProjectId] = useState('')
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const today = localDateKey()

  const load = useCallback(async () => {
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
  }, [toast])

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const groups = useMemo<ProjectGroup[]>(() => {
    const projectNames = new Map(projects.map(project => [project.id, project.name]))
    const grouped = new Map<string, TodoistTask[]>()
    tasks.forEach(task => {
      const id = task.project_id || ''
      grouped.set(id, [...(grouped.get(id) || []), task])
    })
    return [...grouped.entries()]
      .map(([id, projectTasks]) => ({
        id,
        name: id ? projectNames.get(id) || 'Unsorted project' : 'Inbox',
        inbox: !id,
        tasks: projectTasks.sort(sortTasks),
      }))
      .sort((a, b) => Number(b.inbox) - Number(a.inbox) || a.name.localeCompare(b.name))
  }, [projects, tasks])

  const dueToday = tasks.filter(task => task.due?.date === today).length
  const overdue = tasks.filter(task => task.due?.date && task.due.date < today).length

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

  return <main className="x-page x-todos-page">
    <header className="x-todos-hero">
      <div>
        <span className="x-kicker">Program priorities</span>
        <h1>My to-do list</h1>
        <p>Open tasks synced with Todoist and organized by project.</p>
      </div>
      <button className="x-todo-refresh" onClick={load} disabled={loading}><RefreshCw size={15} className={loading ? 'is-loading' : ''} /> Refresh tasks</button>
    </header>

    <section className="x-todo-stats" aria-label="Task summary">
      <div><span><ListTodo size={18} /></span><strong>{tasks.length}</strong><small>Open tasks</small></div>
      <div><span><FolderKanban size={18} /></span><strong>{groups.length}</strong><small>Active projects</small></div>
      <div className={dueToday ? 'is-due' : ''}><span><CalendarClock size={18} /></span><strong>{dueToday}</strong><small>Due today</small></div>
      <div className={overdue ? 'is-overdue' : ''}><span><TriangleAlert size={18} /></span><strong>{overdue}</strong><small>Overdue</small></div>
    </section>

    <form className="x-todo-composer" onSubmit={addTask}>
      <div className="x-todo-composer-title"><span><Plus size={17} /></span><div><strong>Quick add</strong><small>Create a task directly in the right Todoist project.</small></div></div>
      <div className="x-todo-composer-fields">
        <input value={text} onChange={event => setText(event.target.value)} placeholder="What needs to get done?" aria-label="New task" />
        <select value={projectId} onChange={event => setProjectId(event.target.value)} aria-label="Todoist project">
          <option value="">Inbox (no project)</option>
          {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
        </select>
        <button disabled={saving || !text.trim()}><Plus size={16} /> {saving ? 'Adding…' : 'Add task'}</button>
      </div>
    </form>

    {loading ? <section className="x-todo-loading"><RefreshCw size={20} className="is-loading" /><span>Loading your Todoist projects…</span></section>
      : tasks.length === 0 ? <section className="x-todo-empty"><CheckCircle2 size={32} /><h2>Everything is handled.</h2><p>Your open Todoist tasks will appear here by project.</p></section>
        : <section className="x-todo-projects">
          {groups.map(group => <article className="x-todo-project" key={group.id || 'inbox'}>
            <header>
              <span>{group.inbox ? <Inbox size={18} /> : <FolderKanban size={18} />}</span>
              <div><small>{group.inbox ? 'Unassigned tasks' : 'Todoist project'}</small><h2>{group.name}</h2></div>
              <b>{group.tasks.length}</b>
            </header>
            <div className="x-todo-task-list">
              {group.tasks.map(task => {
                const isOverdue = Boolean(task.due?.date && task.due.date < today)
                const isToday = task.due?.date === today
                return <div className="x-todo-task" key={task.id}>
                  <button className="x-todo-complete" onClick={() => completeTask(task.id)} aria-label={`Complete ${task.content}`}><Circle size={20} /><CheckCircle2 size={20} /></button>
                  <div className="x-todo-task-body">
                    <strong>{task.content}</strong>
                    {task.description && <p>{task.description}</p>}
                    {(task.due || task.labels?.length) && <div className="x-todo-meta">
                      {task.due && <span className={isOverdue ? 'is-overdue' : isToday ? 'is-today' : ''}><CalendarClock size={12} />{isOverdue ? 'Overdue · ' : isToday ? 'Today · ' : ''}{task.due.string || task.due.date}</span>}
                      {task.labels?.map(label => <span key={label}><Tag size={11} />{label}</span>)}
                    </div>}
                  </div>
                  {task.priority > 1 && <span className={`x-todo-priority p${task.priority}`}>P{task.priority}</span>}
                </div>
              })}
            </div>
          </article>)}
        </section>}
  </main>
}
