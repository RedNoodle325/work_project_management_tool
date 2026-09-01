'use client'

import { useState } from 'react'
import { AlertTriangle, ArrowRight, CalendarRange, CheckCircle2, ClipboardList, FileText, Printer, ShieldCheck } from 'lucide-react'
import { API } from '../api'
import type { Site, Issue, Note, User } from '../types'
import { useToastFn } from '@/app/providers'

// ── Helpers ────────────────────────────────────────────────────────────────────

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function fmtShort(dt?: string | Date) {
  if (!dt) return '—'
  return new Date(dt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getWeekBounds() {
  const now = new Date()
  const todayDay = now.getDay()
  const startOfThisWeek = new Date(now)
  startOfThisWeek.setDate(now.getDate() - ((todayDay + 6) % 7))
  startOfThisWeek.setHours(0, 0, 0, 0)
  const noteCutoff = new Date(startOfThisWeek)
  noteCutoff.setDate(startOfThisWeek.getDate() - 7)
  return { now, noteCutoff }
}

function renderNoteText(raw?: string): string {
  if (!raw) return '—'
  try {
    const obj = JSON.parse(raw)
    if (obj._type === 'email_chain') return `<em>${esc(obj.subject || 'Email Chain')}</em> · ${Array.isArray(obj.emails) ? obj.emails.length : '?'} messages`
    if (obj.date && obj.attendees) {
      const actions = (obj.actions || obj.agenda || '').slice(0, 100)
      return `<strong>Meeting</strong> · ${esc(obj.attendees.slice(0, 60))}${obj.attendees.length > 60 ? '…' : ''}${actions ? ` — ${esc(actions)}` : ''}`
    }
    if (obj.to_from && obj.notes) return `<strong>${esc(obj.to_from)}</strong>: ${esc(String(obj.notes).slice(0, 120))}${String(obj.notes).length > 120 ? '…' : ''}`
    const text = Object.values(obj).filter(v => typeof v === 'string').join(' · ').slice(0, 150)
    return esc(text) || esc(raw.slice(0, 120))
  } catch {
    return esc((raw || '').slice(0, 150))
  }
}

// ── Report HTML builder ────────────────────────────────────────────────────────

interface ReportData {
  sites: Site[]
  issues: Issue[]
  notes: Note[]
  users: User[]
  siteDetails: Record<string, { campaigns: unknown[]; systems: unknown[] }>
}

const SITE_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  planning:  { label: 'Planning',  color: '#80868b', bg: '#f3f5f5' },
  active:    { label: 'Active',    color: '#61a63a', bg: '#edf6e7' },
  attention: { label: 'Attention', color: '#c77b16', bg: '#fff5df' },
  critical:  { label: 'Critical',  color: '#ec1177', bg: '#fff0f6' },
  offline:   { label: 'Offline',   color: '#52575b', bg: '#edf0f1' },
  complete:  { label: 'Complete',  color: '#009a66', bg: '#e8f8f2' },
  inactive:  { label: 'Inactive',  color: '#80868b', bg: '#f3f5f5' },
}

const PM_COLORS = ['#61a63a', '#009a66', '#28b6ea', '#622c90', '#ec1177', '#fcb215']

function buildReportHtml(data: ReportData, weeklyNotes: string): string {
  const { sites, issues, notes, users } = data
  const { now, noteCutoff } = getWeekBounds()

  const today = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const recentNotes = notes.filter(n => n.created_at && new Date(n.created_at) >= noteCutoff)

  const totalOpen = issues.filter(i => i.status !== 'closed').length
  const materialIssues = issues
    .filter(i => i.status !== 'closed' && ['critical', 'high'].includes(String(i.priority || '').toLowerCase()))
    .slice(0, 8)
  const siteNameById = Object.fromEntries(sites.map(site => [site.id, site.name]))
  const materialIssuesHtml = materialIssues.length
    ? materialIssues.map(issue => `<tr><td style="padding:5px 8px;font-size:9px;color:#52575b">${esc(issue.site_id ? siteNameById[issue.site_id] : 'Unknown site')}</td><td style="padding:5px 8px;font-size:10px">${esc(issue.unit_tag || 'Site-wide')}</td><td style="padding:5px 8px;font-size:10px">${esc(issue.title || issue.description || '—')}</td><td style="padding:5px 8px;font-size:9px;color:#ec1177;font-weight:800;text-transform:uppercase">${esc(issue.priority)}</td></tr>`).join('')
    : '<tr><td colspan="4" style="padding:10px;color:#80868b;font-size:10px;text-align:center">No high-priority exceptions reported.</td></tr>'

  // PM tracker
  const pmMap: Record<string, Site[]> = {}
  for (const site of sites) {
    const pmId = (site as Site & { project_manager_id?: string }).project_manager_id || '__none__'
    if (!pmMap[pmId]) pmMap[pmId] = []
    pmMap[pmId].push(site)
  }

  function issueRowsHtml(openIssues: Issue[]) {
    if (!openIssues.length) return `<tr><td colspan="4" style="padding:6px 8px;color:#aaa;font-size:10px;text-align:center">No open issues</td></tr>`
    const visible = openIssues.slice(0, 10)
    const overflow = openIssues.length - visible.length
    const rows = visible.map(i => {
      const pc = { critical: '#dc2626', high: '#ea580c', low: '#6b7280' }[(i.priority ?? '') as string] || '#6b7280'
      const sc = { open: '#dc2626', in_progress: '#d97706', work_complete: '#16a34a', ready_to_inspect: '#7c3aed', closed: '#6b7280' }[(i.status ?? '') as string] || '#6b7280'
      const sl = { open: 'Open', in_progress: 'In Progress', work_complete: 'Work Complete', ready_to_inspect: 'Ready to Inspect', closed: 'Closed' }[(i.status ?? '') as string] || i.status || '—'
      return `<tr>
        <td style="font-family:monospace;font-size:9px;color:#6b7280;padding:3px 8px;white-space:nowrap">${esc(i.unit_tag || '—')}</td>
        <td style="padding:3px 8px;font-size:10px">${esc(i.title || i.description || '—')}</td>
        <td style="padding:3px 8px;white-space:nowrap"><span style="color:${pc};font-size:9px;font-weight:700">${(i.priority || '').toUpperCase() || '—'}</span></td>
        <td style="padding:3px 8px;white-space:nowrap"><span style="background:${sc}18;color:${sc};border-left:3px solid ${sc};padding:2px 6px;font-size:9px;font-weight:700">${sl}</span></td>
      </tr>`
    }).join('')
    const moreRow = overflow > 0 ? `<tr><td colspan="4" style="padding:4px 8px;font-size:9px;color:#6b7280;font-style:italic;text-align:center;border-top:1px solid #e5e7eb">+ ${overflow} more</td></tr>` : ''
    return rows + moreRow
  }

  function noteRowsHtml(siteNotes: Note[]) {
    if (!siteNotes.length) return `<tr><td colspan="3" style="padding:6px 8px;color:#aaa;font-size:10px;text-align:center">No recent notes</td></tr>`
    return siteNotes.map(n => `<tr>
      <td style="padding:3px 8px;white-space:nowrap;font-size:9px;color:#6b7280;vertical-align:top">${fmtShort(n.created_at)}</td>
      <td style="padding:3px 8px;white-space:nowrap;font-size:9px;color:#6b7280;vertical-align:top">${esc(n.author_name || n.created_by_name || '—')}</td>
      <td style="padding:3px 8px;font-size:10px;max-width:340px;line-height:1.4">${renderNoteText(n.content)}</td>
    </tr>`).join('')
  }

  const pmTrackerHtml = Object.entries(pmMap)
    .sort(([a], [b]) => {
      if (a === '__none__') return 1
      if (b === '__none__') return -1
      const nameA = (users.find(u => u.id === a)?.name || '').toLowerCase()
      const nameB = (users.find(u => u.id === b)?.name || '').toLowerCase()
      return nameA.localeCompare(nameB)
    })
    .map(([pmId, pmSites], idx) => {
      const user = users.find(u => u.id === pmId)
      const pmName = user?.name || user?.email || 'Unassigned'
      const initials = pmName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
      const color = PM_COLORS[idx % PM_COLORS.length]

      const rows = pmSites.map(site => {
        const statusCfg = SITE_STATUS[site.status || site.site_status || 'planning'] || SITE_STATUS.planning
        const openCount = issues.filter(i => i.site_id === site.id && i.status === 'open').length
        const inProgCount = issues.filter(i => i.site_id === site.id && i.status === 'in_progress').length
        const latestNote = recentNotes.filter(n => n.site_id === site.id).sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())[0]
        const updateText = latestNote ? renderNoteText(latestNote.content) : '<span style="color:#9ca3af;font-style:italic">No update this week</span>'
        const issueStr = (openCount + inProgCount) > 0
          ? `${openCount ? `<span style="color:#dc2626;font-weight:700">${openCount} open</span>` : ''}${openCount && inProgCount ? ' · ' : ''}${inProgCount ? `<span style="color:#d97706">${inProgCount} in-prog</span>` : ''}`
          : `<span style="color:#9ca3af">—</span>`
        const location = [site.city, site.state].filter(Boolean).join(', ') || site.address || '—'
        return `<tr style="border-bottom:1px solid #f3f4f6">
          <td style="padding:4px 8px;font-weight:700;font-size:10px;white-space:nowrap">${esc(site.name || '—')}</td>
          <td style="padding:4px 8px;font-size:9px;color:#6b7280;white-space:nowrap">${esc(location)}</td>
          <td style="padding:4px 8px;white-space:nowrap"><span style="background:${statusCfg.bg};color:${statusCfg.color};border-left:3px solid ${statusCfg.color};padding:2px 6px;font-size:9px;font-weight:700">${statusCfg.label}</span></td>
          <td style="padding:4px 8px;font-size:9px;white-space:nowrap">${issueStr}</td>
          <td style="padding:4px 8px;font-size:10px;max-width:260px">${updateText}</td>
        </tr>`
      }).join('')

      return `<div style="margin-bottom:14px;border-left:3px solid ${color};padding-left:10px">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px">
          <div style="width:22px;height:22px;background:${color};color:#000;font-size:9px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0">${initials}</div>
          <span style="font-size:11px;font-weight:700;color:#111827">${esc(pmName)}</span>
          <span style="font-size:9px;color:#6b7280">${pmSites.length} site${pmSites.length !== 1 ? 's' : ''}</span>
        </div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #d5dadd;overflow:hidden;font-size:10px">
          <thead><tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb">
            ${['Site', 'Location', 'Status', 'Issues', "This Week's Update"].map(h =>
              `<th style="padding:4px 8px;font-size:8px;text-transform:uppercase;color:#9ca3af;font-weight:700;text-align:left">${h}</th>`
            ).join('')}
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
    }).join('')

  // Per-site detail sections
  const detailSectionsHtml = sites.map(site => {
    const openIssues = issues.filter(i => i.site_id === site.id && i.status !== 'closed')
    const siteNotes = recentNotes.filter(n => n.site_id === site.id)
    const statusCfg = SITE_STATUS[site.status || site.site_status || 'planning'] || SITE_STATUS.planning

    return `<div style="page-break-before:always;margin:0 24px 32px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid #e5e7eb">
        <div>
          <div style="font-size:14px;font-weight:800;color:#111827">${esc(site.name)}</div>
          ${[site.city, site.state].filter(Boolean).length ? `<div style="font-size:10px;color:#6b7280;margin-top:2px">${esc([site.city, site.state].filter(Boolean).join(', '))}</div>` : ''}
        </div>
        <span style="background:${statusCfg.bg};color:${statusCfg.color};border-left:3px solid ${statusCfg.color};padding:3px 9px;font-size:10px;font-weight:700">${statusCfg.label}</span>
      </div>

      <!-- Issues -->
      <div style="margin-bottom:14px">
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:4px">Open Issues (${openIssues.length})</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;font-size:10px">
          <thead><tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb">
            ${['Equipment', 'Description', 'Priority', 'Status'].map(h =>
              `<th style="padding:4px 8px;font-size:8px;text-transform:uppercase;color:#9ca3af;font-weight:700;text-align:left">${h}</th>`
            ).join('')}
          </tr></thead>
          <tbody>${issueRowsHtml(openIssues)}</tbody>
        </table>
      </div>

      <!-- Notes -->
      <div>
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;color:#6b7280;margin-bottom:4px">Recent Notes</div>
        <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;font-size:10px">
          <thead><tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb">
            ${['Date', 'Author', 'Note'].map(h =>
              `<th style="padding:4px 8px;font-size:8px;text-transform:uppercase;color:#9ca3af;font-weight:700;text-align:left">${h}</th>`
            ).join('')}
          </tr></thead>
          <tbody>${noteRowsHtml(siteNotes)}</tbody>
        </table>
      </div>
    </div>`
  }).join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>XNRGY Weekly Program Status — ${today}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Arial Narrow','Roboto Condensed',Arial,sans-serif; margin: 0; background: #fff; color: #0b0b0c; }
  .report-accent { height: 4px; background: linear-gradient(90deg,#61a63a,#009a66,#28b6ea,#2c3891,#622c90,#ec1177,#fcb215); }
  .report-label { color:#52575b;font-size:8px;font-weight:700;letter-spacing:.18em;text-transform:uppercase; }
  table { break-inside: avoid; }
  @media print {
    .no-print { display: none !important; }
    body { font-size: 10px; }
    @page { size: Letter portrait; margin: .45in; }
    .report-accent { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="report-accent"></div>
  <!-- HEADER -->
  <div style="background:#000;color:#fff;padding:16px 24px;display:flex;align-items:center;gap:14px;border-bottom:1px solid #2a2c2e">
    <img src="/brand/xnrgy-mark.svg" alt="XNRGY" style="width:34px;height:34px;object-fit:contain">
    <div>
      <div style="font-size:16px;font-weight:800;letter-spacing:.08em">WEEKLY PROGRAM STATUS</div>
      <div style="font-size:9px;color:#cad0d3;margin-top:3px;letter-spacing:.14em;text-transform:uppercase">XNRGY Site Intelligence · ${today}</div>
    </div>
    <div style="flex:1"></div>
    <div style="text-align:right"><div class="report-label" style="color:#a8aeb3">Reporting period</div><strong style="display:block;margin-top:4px;font-size:11px;color:#fff">${fmtShort(noteCutoff)} – ${fmtShort(now)}</strong></div>
  </div>

  <!-- STATS BAR -->
  <div style="margin:18px 24px 8px"><div class="report-label">Executive summary</div></div>
  <div style="display:flex;gap:22px;margin:8px 24px 16px;padding:12px 14px;background:#f5f6f6;border-block:1px solid #d5dadd;align-items:center">
    ${Object.entries(SITE_STATUS).map(([key, cfg]) => {
      const count = sites.filter(s => (s.status || s.site_status || 'planning') === key).length
      if (!count) return ''
      return `<div style="text-align:center"><div style="font-size:18px;font-weight:800;color:${cfg.color}">${count}</div><div style="font-size:8px;text-transform:uppercase;color:#6b7280">${cfg.label}</div></div>`
    }).join('')}
    <div style="width:1px;background:#e5e7eb;align-self:stretch;margin:0 4px"></div>
    <div style="text-align:center"><div style="font-size:18px;font-weight:800;color:#dc2626">${totalOpen}</div><div style="font-size:8px;text-transform:uppercase;color:#6b7280">Open Issues</div></div>
    <div style="text-align:center"><div style="font-size:18px;font-weight:800;color:#111827">${sites.length}</div><div style="font-size:8px;text-transform:uppercase;color:#6b7280">Total Sites</div></div>
  </div>

  <!-- MATERIAL EXCEPTIONS -->
  <div style="margin:0 24px 16px">
    <div class="report-label" style="margin-bottom:6px">Material risks / exceptions</div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #d5dadd">
      <thead><tr style="background:#f5f6f6">${['Site','Equipment','Exception','Priority'].map(label => `<th style="padding:5px 8px;color:#52575b;font-size:8px;text-align:left;letter-spacing:.12em;text-transform:uppercase">${label}</th>`).join('')}</tr></thead>
      <tbody>${materialIssuesHtml}</tbody>
    </table>
  </div>

  <!-- PM PROJECT TRACKER -->
  <div style="margin:12px 24px 0">
    <div class="report-label" style="margin-bottom:8px">Program ownership &amp; weekly status</div>
    ${pmTrackerHtml}
  </div>

  <!-- WEEKLY NOTES -->
  <div style="margin:14px 24px 0">
    <div class="report-label" style="margin-bottom:5px">Executive notes / decisions required</div>
    <div style="min-height:72px;border:1px solid #d5dadd;padding:11px 12px;font-size:11px;line-height:1.6;color:#0b0b0c;white-space:pre-wrap">${esc(weeklyNotes) || '<span style="color:#80868b;font-style:italic">No executive notes entered for this reporting period.</span>'}</div>
  </div>

  <!-- SITE DETAIL PAGES -->
  ${detailSectionsHtml}
</body>
</html>`
}

// ── Activity Log HTML builder ──────────────────────────────────────────────────

type ActivityEvent =
  | { type: 'issue_opened';  date: Date; issue: Issue; siteName: string }
  | { type: 'issue_closed';  date: Date; issue: Issue; siteName: string }
  | { type: 'issue_updated'; date: Date; issue: Issue; siteName: string }
  | { type: 'note';          date: Date; note: Note;   siteName: string }

function buildActivityLogHtml(events: ActivityEvent[], label: string): string {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  const EVENT_CFG: Record<string, { label: string; color: string; bg: string }> = {
    issue_opened:  { label: 'Issue Opened',  color: '#ec1177', bg: '#fff0f6' },
    issue_closed:  { label: 'Issue Closed',  color: '#009a66', bg: '#e8f8f2' },
    issue_updated: { label: 'Issue Updated', color: '#c77b16', bg: '#fff5df' },
    note:          { label: 'Contact Logged',color: '#28b6ea', bg: '#eaf8fd' },
  }

  // Group by date
  const byDay: Record<string, ActivityEvent[]> = {}
  for (const ev of events) {
    const key = ev.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    if (!byDay[key]) byDay[key] = []
    byDay[key].push(ev)
  }

  const rowsHtml = Object.entries(byDay).map(([day, dayEvents]) => {
    const eventRows = dayEvents.map(ev => {
      const cfg = EVENT_CFG[ev.type]
      const time = ev.date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      let detail = ''
      if (ev.type === 'note') {
        detail = renderNoteText(ev.note.content)
        const author = ev.note.author_name || ev.note.created_by_name
        if (author) detail = `<strong>${esc(author)}</strong>: ` + detail
      } else {
        const { issue } = ev
        detail = `<strong>${esc(issue.title || '—')}</strong>`
        if (issue.unit_tag) detail += ` <span style="color:#6b7280;font-size:9px">[${esc(issue.unit_tag)}]</span>`
        if (ev.type === 'issue_updated') {
          const statusLabel: Record<string, string> = { open: 'Open', in_progress: 'In Progress', work_complete: 'Work Complete', ready_to_inspect: 'Ready to Inspect', closed: 'Closed' }
          const s = statusLabel[issue.status ?? ''] ?? issue.status ?? ''
          if (s) detail += ` <span style="color:#6b7280;font-size:9px">→ ${esc(s)}</span>`
        }
      }
      return `<tr style="border-bottom:1px solid #f3f4f6">
        <td style="padding:5px 8px;white-space:nowrap;font-size:9px;color:#6b7280;vertical-align:top">${time}</td>
        <td style="padding:5px 8px;white-space:nowrap;vertical-align:top">
          <span style="background:${cfg.bg};color:${cfg.color};border-left:3px solid ${cfg.color};padding:2px 7px;font-size:9px;font-weight:700">${cfg.label}</span>
        </td>
        <td style="padding:5px 8px;white-space:nowrap;font-size:10px;font-weight:600;vertical-align:top;color:#374151">${esc(ev.siteName)}</td>
        <td style="padding:5px 8px;font-size:10px;line-height:1.5;vertical-align:top">${detail}</td>
      </tr>`
    }).join('')

    return `<div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;color:#0b0b0c;background:#f5f6f6;border:1px solid #d5dadd;padding:5px 10px;border-bottom:none">${day}</div>
      <table style="width:100%;border-collapse:collapse;border:1px solid #d5dadd;overflow:hidden">
        <thead><tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb">
          ${['Time','Event','Site','Details'].map(h => `<th style="padding:4px 8px;font-size:8px;text-transform:uppercase;color:#9ca3af;font-weight:700;text-align:left">${h}</th>`).join('')}
        </tr></thead>
        <tbody>${eventRows}</tbody>
      </table>
    </div>`
  }).join('')

  const counts = {
    opened: events.filter(e => e.type === 'issue_opened').length,
    closed: events.filter(e => e.type === 'issue_closed').length,
    updated: events.filter(e => e.type === 'issue_updated').length,
    notes: events.filter(e => e.type === 'note').length,
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Activity Log — ${today}</title>
<style>
  * { box-sizing:border-box; }
  body { font-family:'Arial Narrow','Roboto Condensed',Arial,sans-serif; margin:0; background:#fff; color:#0b0b0c; }
  .report-accent { height:4px;background:linear-gradient(90deg,#61a63a,#009a66,#28b6ea,#2c3891,#622c90,#ec1177,#fcb215); }
  @media print { .no-print { display:none !important; } body { font-size:10px; } @page { size:Letter portrait; margin:.45in; } }
</style>
</head>
<body>
  <div class="report-accent"></div>
  <div style="background:#000;color:#fff;padding:16px 24px;display:flex;align-items:center;gap:14px;border-bottom:1px solid #2a2c2e">
    <img src="/brand/xnrgy-mark.svg" alt="XNRGY" style="width:34px;height:34px;object-fit:contain">
    <div>
      <div style="font-size:16px;font-weight:800;letter-spacing:.08em">PROGRAM ACTIVITY LOG</div>
      <div style="font-size:9px;color:#cad0d3;margin-top:3px;letter-spacing:.12em;text-transform:uppercase">XNRGY Site Intelligence · ${label} · ${today}</div>
    </div>
  </div>
  <div style="display:flex;gap:20px;margin:18px 24px;padding:10px 14px;background:#f5f6f6;border-block:1px solid #d5dadd;align-items:center">
    <div style="text-align:center"><div style="font-size:20px;font-weight:800;color:#dc2626">${counts.opened}</div><div style="font-size:8px;text-transform:uppercase;color:#6b7280">Opened</div></div>
    <div style="text-align:center"><div style="font-size:20px;font-weight:800;color:#16a34a">${counts.closed}</div><div style="font-size:8px;text-transform:uppercase;color:#6b7280">Closed</div></div>
    <div style="text-align:center"><div style="font-size:20px;font-weight:800;color:#d97706">${counts.updated}</div><div style="font-size:8px;text-transform:uppercase;color:#6b7280">Updated</div></div>
    <div style="text-align:center"><div style="font-size:20px;font-weight:800;color:#28b6ea">${counts.notes}</div><div style="font-size:8px;text-transform:uppercase;color:#6b7280">Contacts</div></div>
    <div style="text-align:center"><div style="font-size:20px;font-weight:800;color:#111827">${events.length}</div><div style="font-size:8px;text-transform:uppercase;color:#6b7280">Total Events</div></div>
  </div>
  <div style="margin:0 24px 24px">
    ${events.length === 0
      ? `<div style="text-align:center;color:#80868b;padding:40px;border:1px dashed #d5dadd;font-size:13px">No activity in this period</div>`
      : rowsHtml}
  </div>
</body>
</html>`
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export function Report() {
  const toast = useToastFn()
  const [loading, setLoading] = useState(false)
  const [weeklyNotes, setWeeklyNotes] = useState('')
  const [activityRange, setActivityRange] = useState('30')
  const [activityFrom, setActivityFrom] = useState('')
  const [activityTo, setActivityTo] = useState('')
  const [activityLoading, setActivityLoading] = useState(false)

  async function buildActivityLog() {
    setActivityLoading(true)
    let reportWindow: Window | null = null
    try {
      let cutoff: Date
      let endDate = new Date()
      let label: string

      if (activityRange === 'custom') {
        if (!activityFrom) { toast('Select a start date', 'error'); return }
        cutoff = new Date(activityFrom + 'T00:00:00')
        endDate = activityTo ? new Date(activityTo + 'T23:59:59') : new Date()
        label = `${fmtShort(cutoff)} – ${fmtShort(endDate)}`
      } else {
        const days = parseInt(activityRange, 10)
        cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - days)
        cutoff.setHours(0, 0, 0, 0)
        label = `Last ${days} days`
      }

      reportWindow = window.open('', '_blank')
      if (!reportWindow) { toast('Popup blocked — allow pop-ups and try again', 'error'); return }
      reportWindow.document.write('<title>Building activity log</title><body style="font-family:Arial,sans-serif;padding:32px">Preparing activity log…</body>')
      reportWindow.document.close()

      const [sites, issues, notes] = await Promise.all([
        API.sites.list(),
        API.issues.listAll().catch(() => [] as Issue[]),
        API.notes.search('').catch(() => [] as Note[]),
      ])
      const siteMap = Object.fromEntries(sites.map(s => [s.id, s.name ?? s.id]))

      const events: ActivityEvent[] = []

      for (const issue of issues) {
        const siteName = (issue.site_id ? siteMap[issue.site_id] : undefined) ?? 'Unknown Site'

        if (issue.created_at) {
          const d = new Date(issue.created_at)
          if (d >= cutoff && d <= endDate)
            events.push({ type: 'issue_opened', date: d, issue, siteName })
        }

        if (issue.closed_date && issue.status === 'closed') {
          const d = new Date(issue.closed_date)
          if (d >= cutoff && d <= endDate)
            events.push({ type: 'issue_closed', date: d, issue, siteName })
        }

        if (issue.updated_at && issue.created_at) {
          const upd = new Date(issue.updated_at)
          const created = new Date(issue.created_at)
          if (upd >= cutoff && upd <= endDate && upd.getTime() - created.getTime() > 60_000)
            events.push({ type: 'issue_updated', date: upd, issue, siteName })
        }
      }

      for (const note of notes) {
        if (note.created_at) {
          const d = new Date(note.created_at)
          if (d >= cutoff && d <= endDate) {
            const siteName = (note.site_id ? siteMap[note.site_id] : undefined) ?? 'Unknown Site'
            events.push({ type: 'note', date: d, note, siteName })
          }
        }
      }

      events.sort((a, b) => b.date.getTime() - a.date.getTime())

      const html = buildActivityLogHtml(events, label)
      reportWindow.document.open()
      reportWindow.document.write(html)
      reportWindow.document.close()
    } catch (err: unknown) {
      reportWindow?.close()
      toast('Error: ' + (err as Error).message, 'error')
    } finally {
      setActivityLoading(false)
    }
  }

  async function buildReport() {
    setLoading(true)
    toast('Building report…')
    const reportWindow = window.open('', '_blank')
    if (!reportWindow) { toast('Popup blocked — allow pop-ups and try again', 'error'); setLoading(false); return }
    reportWindow.document.write('<title>Building weekly report</title><body style="font-family:Arial,sans-serif;padding:32px">Preparing weekly report…</body>')
    reportWindow.document.close()
    try {
      const [sites, issues, notes, users] = await Promise.all([
        API.sites.list(),
        API.issues.listAll().catch(() => [] as Issue[]),
        API.notes.search('').catch(() => [] as Note[]),
        API.auth.listUsers().catch(() => [] as User[]),
      ])

      // Per-site detail data
      const siteDetails: Record<string, { campaigns: unknown[]; systems: unknown[] }> = {}
      await Promise.all(sites.map(async s => {
        const [campaigns, systems] = await Promise.all([
          API.campaigns.list(s.id).catch(() => []),
          API.systems.list(s.id).catch(() => []),
        ])
        siteDetails[s.id] = { campaigns, systems }
      }))

      const html = buildReportHtml({ sites, issues, notes, users, siteDetails }, weeklyNotes)
      reportWindow.document.open()
      reportWindow.document.write(html)
      reportWindow.document.close()
    } catch (err: unknown) {
      reportWindow.close()
      toast('Failed to load report data: ' + (err as Error).message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const { noteCutoff, now } = getWeekBounds()

  return (
    <div className="x-page x-report-page">
      <header className="x-directory-head x-report-head">
        <div>
          <span className="x-kicker">Program communications</span>
          <h1>Reports</h1>
          <p>Prepare consistent XNRGY weekly status and activity reports from live site data.</p>
        </div>
        <button className="x-report-primary" onClick={buildReport} disabled={loading}>
          <FileText size={15} /> {loading ? 'Building…' : 'Generate weekly report'}
        </button>
      </header>

      <div className="x-report-studio">
        <section className="x-report-compose">
          <div className="x-report-section-head"><div><span>Weekly status</span><h2>Executive briefing</h2></div><CalendarRange size={20} /></div>
          <div className="x-report-period"><small>Reporting period</small><strong>{fmtShort(noteCutoff)} – {fmtShort(now)}</strong></div>
          <label className="x-report-notes"><span>Executive notes / decisions required</span><textarea rows={9} value={weeklyNotes} onChange={e => setWeeklyNotes(e.target.value)} placeholder="Summarize decisions, customer commitments, material risks, and help needed from leadership." /></label>
          <div className="x-report-actions"><button onClick={() => setWeeklyNotes('')}>Clear notes</button><button className="primary" onClick={buildReport} disabled={loading}><FileText size={14} /> {loading ? 'Building…' : 'Generate weekly report'}<ArrowRight size={14} /></button></div>
        </section>

        <aside className="x-report-standard">
          <div className="x-report-section-head"><div><span>Output standard</span><h2>Report requirements</h2></div><ShieldCheck size={20} /></div>
          <ul>
            <li><CheckCircle2 size={15} /><span><strong>XNRGY identity</strong><small>Approved typography, brand spectrum, and black report masthead.</small></span></li>
            <li><CheckCircle2 size={15} /><span><strong>Executive first</strong><small>Reporting period, portfolio totals, risks, and decisions before detail.</small></span></li>
            <li><AlertTriangle size={15} /><span><strong>Exceptions explicit</strong><small>Site, equipment, priority, status, owner, and latest update remain explicit.</small></span></li>
            <li><Printer size={15} /><span><strong>Print ready</strong><small>Letter-size pagination with stable tables and no editable fields in output.</small></span></li>
          </ul>
        </aside>
      </div>

      <section className="x-report-activity">
        <div className="x-report-section-head"><div><span>Audit trail</span><h2>Program activity log</h2><p>Issues opened, closed, or updated and contacts logged within a selected period.</p></div><ClipboardList size={21} /></div>
        <div className="x-report-activity-form">
          <label><span>Date range</span><select value={activityRange} onChange={e => setActivityRange(e.target.value)}>
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="365">Last 12 months</option>
              <option value="custom">Custom range…</option>
          </select></label>
          {activityRange === 'custom' && <><label><span>From</span><input type="date" value={activityFrom} onChange={e => setActivityFrom(e.target.value)} /></label><label><span>To</span><input type="date" value={activityTo} onChange={e => setActivityTo(e.target.value)} /></label></>}
          <button className="x-report-primary" onClick={buildActivityLog} disabled={activityLoading}><ClipboardList size={14} /> {activityLoading ? 'Building…' : 'Generate activity log'}</button>
        </div>
        <div className="x-report-includes"><span><i className="is-open" />Issues opened</span><span><i className="is-closed" />Issues closed</span><span><i className="is-updated" />Issues updated</span><span><i className="is-contact" />Contacts and notes</span></div>
      </section>
    </div>
  )
}
