import { NextRequest } from 'next/server'
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
  scope?: string
  notes?: string
}

const PURPLE = '622C90'
const DEEP_PURPLE = '251A4D'
const GREEN = '61A63A'
const LIGHT_PURPLE = 'F3EEF7'
const LIGHT_GRAY = 'F5F6F6'
const BORDER = 'CAD0D3'

function addDays(isoDate: string, amount: number) {
  const date = new Date(`${isoDate}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + amount)
  return date.toISOString().slice(0, 10)
}

function displayDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
  })
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { allowReadOnlyOwner: true, allowScheduler: true })
  if (auth.error) return auth.error

  const body = await request.json()
  const data = body?.data
  const weekStart = typeof body?.weekStart === 'string' ? body.weekStart : ''
  if (!data || !Array.isArray(data.sites) || !Array.isArray(data.employees) || !data.assignments || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) {
    return Response.json({ error: 'Valid scheduler data and weekStart are required.' }, { status: 400 })
  }

  const sites = data.sites as Site[]
  const technicians = data.employees as Technician[]
  const assignments = data.assignments as Record<string, Assignment>
  const siteNames = new Map(sites.map(site => [site.id, site.name]))
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))

  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'XNRGY Site Intelligence'
  workbook.created = new Date()
  const sheet = workbook.addWorksheet('Weekly Technician Schedule', {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 5 }],
    pageSetup: {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: { left: 0.25, right: 0.25, top: 0.45, bottom: 0.45, header: 0.2, footer: 0.2 },
    },
    properties: { defaultRowHeight: 22 },
  })

  sheet.columns = [
    { key: 'technician', width: 31 },
    { key: 'classification', width: 13 },
    { key: 'specialty', width: 16 },
    { key: 'homeState', width: 12 },
    { key: 'homeSite', width: 16 },
    { key: 'notes', width: 24 },
    ...days.map((date, index) => ({ key: `day${index}`, width: 22 })),
  ]

  sheet.mergeCells('A1:B3')
  const brandCell = sheet.getCell('A1')
  brandCell.value = 'XNRGY'
  brandCell.font = { name: 'Arial', bold: true, size: 24, color: { argb: 'FFFFFFFF' } }
  brandCell.alignment = { vertical: 'middle', horizontal: 'center' }
  brandCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${DEEP_PURPLE}` } }

  sheet.mergeCells('C1:M2')
  const titleCell = sheet.getCell('C1')
  titleCell.value = 'WEEKLY TECHNICIAN DEPLOYMENT'
  titleCell.font = { name: 'Arial', bold: true, size: 20, color: { argb: `FF${DEEP_PURPLE}` } }
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' }

  sheet.mergeCells('C3:M3')
  const subtitleCell = sheet.getCell('C3')
  subtitleCell.value = `Sunday ${displayDate(days[0])} – Saturday ${displayDate(days[6])}`
  subtitleCell.font = { name: 'Arial', bold: true, size: 11, color: { argb: `FF${PURPLE}` } }
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' }

  const headers = ['Technician', 'Classification', 'Chiller / Air', 'Home State', 'Home Site', 'Roster Notes', ...days.map((date, index) => `${['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][index]}\n${displayDate(date)}`)]
  const headerRow = sheet.getRow(5)
  headerRow.values = headers
  headerRow.height = 34
  headerRow.eachCell(cell => {
    cell.font = { name: 'Arial', bold: true, size: 10, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${PURPLE}` } }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = { top: { style: 'thin', color: { argb: `FF${BORDER}` } }, left: { style: 'thin', color: { argb: `FF${BORDER}` } }, bottom: { style: 'thin', color: { argb: `FF${BORDER}` } }, right: { style: 'thin', color: { argb: `FF${BORDER}` } } }
  })

  technicians.forEach((technician, technicianIndex) => {
    const rowValues: (string | number)[] = [
      technician.name,
      technician.classification || '',
      technician.specialty || '',
      technician.homeState || '',
      siteNames.get(technician.homeSite || '') || '',
      technician.notes || '',
    ]

    days.forEach(date => {
      const assignment = assignments[`${technician.id}|${date}`]
      const assignedSite = siteNames.get(assignment?.siteId || '') || ''
      const status = assignment?.status || 'Unassigned'
      const offReason = ['PTO', 'Holiday', 'Day Off'].includes(status) ? status : ''
      const details = [offReason || assignedSite, assignment?.scope || assignment?.notes || ''].filter(Boolean)
      rowValues.push(details.join(' • ') || '—')
    })

    const row = sheet.addRow(rowValues)
    row.height = 31
    row.eachCell((cell, columnNumber) => {
      cell.font = { name: 'Arial', size: 9, color: { argb: 'FF25282B' }, bold: columnNumber === 1 }
      cell.alignment = { vertical: 'middle', horizontal: columnNumber >= 7 ? 'center' : 'left', wrapText: true }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: technicianIndex % 2 === 0 ? 'FFFFFFFF' : `FF${LIGHT_GRAY}` } }
      cell.border = { top: { style: 'thin', color: { argb: `FF${BORDER}` } }, left: { style: 'thin', color: { argb: `FF${BORDER}` } }, bottom: { style: 'thin', color: { argb: `FF${BORDER}` } }, right: { style: 'thin', color: { argb: `FF${BORDER}` } } }
    })
    for (let column = 7; column <= 13; column += 1) {
      const cell = row.getCell(column)
      if (cell.value && cell.value !== '—') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${LIGHT_PURPLE}` } }
        cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: `FF${DEEP_PURPLE}` } }
      }
    }
  })

  const footerRow = sheet.addRow([])
  footerRow.getCell(1).value = 'Generated from XNRGY Site Intelligence'
  footerRow.getCell(1).font = { name: 'Arial', italic: true, size: 9, color: { argb: `FF${PURPLE}` } }
  sheet.mergeCells(footerRow.number, 1, footerRow.number, 13)
  sheet.autoFilter = { from: 'A5', to: 'M5' }
  sheet.getColumn(1).eachCell(cell => { cell.border = { ...cell.border, left: { style: 'medium', color: { argb: `FF${GREEN}` } } } })
  sheet.headerFooter.oddFooter = '&LXNRGY Site Intelligence&CWeekly Technician Deployment&RPage &P of &N'

  const buffer = await workbook.xlsx.writeBuffer()
  const filename = `xnrgy-technician-schedule-${weekStart}.xlsx`
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
