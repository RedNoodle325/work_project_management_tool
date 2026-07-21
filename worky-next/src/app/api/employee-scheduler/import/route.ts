import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { requireAuth } from '@/lib/requireAuth'

type Site = { id: string; name: string }
type Technician = {
  id: string
  name: string
  classification?: string
  specialty?: string
  homeState?: string
  homeSite?: string
  notes?: string
}
type Assignment = {
  employeeId: string
  date: string
  siteId?: string
  status?: string
  start?: string
  end?: string
  scope?: string
  notes?: string
}
type SchedulerData = {
  sites: Site[]
  employees: Technician[]
  assignments: Record<string, Assignment>
  jobs?: unknown[]
}

const OFF_REASONS = new Map([
  ['pto', 'PTO'],
  ['day off', 'Day Off'],
  ['holiday', 'Holiday'],
])

function cleanCell(cell: ExcelJS.Cell) {
  return cell.text.trim()
}

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase('en-US')
}

function assignmentKey(employeeId: string, date: string) {
  return `${employeeId}|${date}`
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { allowScheduler: true })
  if (auth.error) return auth.error

  const form = await request.formData()
  const file = form.get('file')
  const rawData = form.get('data')
  if (!(file instanceof File) || typeof rawData !== 'string') {
    return NextResponse.json({ error: 'An exported Excel workbook and current scheduler data are required.' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'The Excel workbook must be smaller than 10 MB.' }, { status: 413 })
  }

  let data: SchedulerData
  try {
    data = JSON.parse(rawData) as SchedulerData
  } catch {
    return NextResponse.json({ error: 'The current scheduler data is invalid.' }, { status: 400 })
  }
  if (!Array.isArray(data.sites) || !Array.isArray(data.employees) || !data.assignments || typeof data.assignments !== 'object') {
    return NextResponse.json({ error: 'The current scheduler data is incomplete.' }, { status: 400 })
  }

  const workbook = new ExcelJS.Workbook()
  try {
    await workbook.xlsx.load(await file.arrayBuffer())
  } catch {
    return NextResponse.json({ error: 'The file is not a readable .xlsx workbook.' }, { status: 400 })
  }

  const schedule = workbook.getWorksheet('Weekly Technician Schedule')
  const importMap = workbook.getWorksheet('_Scheduler Import Map')
  if (!schedule || !importMap || cleanCell(importMap.getCell('A1')) !== 'XNRGY_SCHEDULER_IMPORT_V1') {
    return NextResponse.json({ error: 'Use an Excel workbook created by the scheduler’s Export Excel button.' }, { status: 400 })
  }

  const weekStart = cleanCell(importMap.getCell('B2'))
  const dates = Array.from({ length: 7 }, (_, index) => cleanCell(importMap.getCell(4, 4 + index)))
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || dates.some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
    return NextResponse.json({ error: 'The workbook import map is missing valid schedule dates.' }, { status: 400 })
  }

  const rowMap = new Map<number, string>()
  for (let rowNumber = 5; rowNumber <= importMap.rowCount; rowNumber += 1) {
    const visibleRow = Number(importMap.getCell(rowNumber, 1).value)
    const employeeId = cleanCell(importMap.getCell(rowNumber, 2))
    if (Number.isInteger(visibleRow) && employeeId) rowMap.set(visibleRow, employeeId)
  }

  const sitesByName = new Map(data.sites.map(site => [normalizeName(site.name), site]))
  const employeesById = new Map(data.employees.map(employee => [employee.id, employee]))
  const employeesByName = new Map<string, Technician>()
  const duplicateNames = new Set<string>()
  data.employees.forEach(employee => {
    const key = normalizeName(employee.name)
    if (employeesByName.has(key)) duplicateNames.add(key)
    employeesByName.set(key, employee)
  })
  duplicateNames.forEach(name => employeesByName.delete(name))

  const errors: string[] = []
  let importedAssignments = 0
  let preservedPto = 0

  for (const [visibleRow, mappedEmployeeId] of rowMap) {
    const visibleName = cleanCell(schedule.getCell(visibleRow, 1))
    const employee = employeesByName.get(normalizeName(visibleName)) || employeesById.get(mappedEmployeeId)
    if (!employee) {
      errors.push(`Row ${visibleRow}: technician “${visibleName || mappedEmployeeId}” was not found.`)
      continue
    }

    employee.classification = cleanCell(schedule.getCell(visibleRow, 2))
    employee.specialty = cleanCell(schedule.getCell(visibleRow, 3))
    employee.homeState = cleanCell(schedule.getCell(visibleRow, 4))
    employee.notes = cleanCell(schedule.getCell(visibleRow, 6))
    const homeSiteName = cleanCell(schedule.getCell(visibleRow, 5))
    if (!homeSiteName || homeSiteName === '—') {
      employee.homeSite = ''
    } else {
      const homeSite = sitesByName.get(normalizeName(homeSiteName))
      if (homeSite) employee.homeSite = homeSite.id
      else errors.push(`Row ${visibleRow}: home site “${homeSiteName}” does not exist in the scheduler.`)
    }

    dates.forEach((date, index) => {
      const cellValue = cleanCell(schedule.getCell(visibleRow, 7 + index))
      const key = assignmentKey(employee.id, date)
      const current = data.assignments[key] || { employeeId: employee.id, date, siteId: '', status: 'Unassigned', start: '', end: '', scope: '', notes: '' }
      const parts = cellValue.split(/\s*•\s*/).map(part => part.trim()).filter(Boolean)
      const primary = parts.shift() || ''
      const detail = parts.join(' • ')
      const normalizedPrimary = normalizeName(primary)
      const offReason = OFF_REASONS.get(normalizedPrimary)

      if (offReason) {
        data.assignments[key] = { ...current, employeeId: employee.id, date, siteId: '', status: offReason, start: '', end: '', scope: '', notes: detail }
        importedAssignments += 1
        return
      }

      if (!primary || primary === '—' || normalizedPrimary === 'unassigned') {
        if (current.status === 'PTO') { preservedPto += 1; return }
        data.assignments[key] = { ...current, employeeId: employee.id, date, siteId: '', status: 'Unassigned', start: '', end: '', scope: '', notes: '' }
        importedAssignments += 1
        return
      }

      const site = sitesByName.get(normalizedPrimary)
      if (!site) {
        errors.push(`Row ${visibleRow}, ${date}: site “${primary}” does not exist in the scheduler.`)
        return
      }
      if (current.status === 'PTO') { preservedPto += 1; return }
      data.assignments[key] = { ...current, employeeId: employee.id, date, siteId: site.id, status: 'Working', start: '', end: '', scope: detail, notes: '' }
      importedAssignments += 1
    })
  }

  if (errors.length) {
    return NextResponse.json({
      error: 'The workbook contains values that cannot be imported.',
      details: errors.slice(0, 20),
      additional_errors: Math.max(0, errors.length - 20),
    }, { status: 400 })
  }

  return NextResponse.json({ data, weekStart, importedAssignments, preservedPto })
}
