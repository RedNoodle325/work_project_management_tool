import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { requireAuth } from '@/lib/requireAuth'
import sql from '@/lib/db'
import { upsertLeanIssues, type LeanIssueInput } from '@/lib/issueImport'

const issueKeys = ['name', 'issue number', 'issue #', 'issue id', 'number']
const descriptionKeys = ['description', 'details']
const equipmentKeys = ['asset', 'equipment', 'equipment name', 'asset tag', 'equipment tag']
const serialKeys = ['serial #', 'serial number', 'serial no', 'serial']
const linkKeys = ['link', 'url', 'issue url']

function text(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object') {
    if ('text' in value) return String(value.text)
    if ('richText' in value) return value.richText.map(part => part.text).join('')
    if ('result' in value) return String(value.result ?? '')
    if ('hyperlink' in value) return String(('text' in value && value.text) || value.hyperlink)
  }
  return String(value).trim()
}

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function findColumn(headers: Map<string, number>, keys: string[]) {
  for (const key of keys) {
    const column = headers.get(key)
    if (column) return column
  }
  return 0
}

export async function POST(request: NextRequest) {
  const { error } = await requireAuth(request)
  if (error) return error
  const form = await request.formData()
  const file = form.get('file')
  const siteId = String(form.get('site_id') || '')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a CxAlloy Excel export.' }, { status: 400 })
  if (!siteId) return NextResponse.json({ error: 'Choose a site.' }, { status: 400 })
  const [site] = await sql`select id from public.sites where id = ${siteId}`
  if (!site) return NextResponse.json({ error: 'Site not found.' }, { status: 404 })

  const workbook = new ExcelJS.Workbook()
  const fileBuffer = await file.arrayBuffer() as Parameters<typeof workbook.xlsx.load>[0]
  await workbook.xlsx.load(fileBuffer)
  const sheet = workbook.worksheets[0]
  if (!sheet) return NextResponse.json({ error: 'The workbook has no worksheets.' }, { status: 400 })

  let headerRowNumber = 0
  let headers = new Map<string, number>()
  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 20); rowNumber++) {
    const candidate = new Map<string, number>()
    sheet.getRow(rowNumber).eachCell((cell, column) => candidate.set(normalize(text(cell.value)), column))
    if (findColumn(candidate, issueKeys) && findColumn(candidate, descriptionKeys)) {
      headerRowNumber = rowNumber
      headers = candidate
      break
    }
  }
  if (!headerRowNumber) return NextResponse.json({ error: 'Could not find the CxAlloy issue headers.' }, { status: 400 })

  const issueColumn = findColumn(headers, issueKeys)
  const descriptionColumn = findColumn(headers, descriptionKeys)
  const equipmentColumn = findColumn(headers, equipmentKeys)
  const serialColumn = findColumn(headers, serialKeys)
  const linkColumn = findColumn(headers, linkKeys)
  const issues: LeanIssueInput[] = []

  for (let rowNumber = headerRowNumber + 1; rowNumber <= sheet.rowCount; rowNumber++) {
    const row = sheet.getRow(rowNumber)
    const issueNumber = text(row.getCell(issueColumn).value)
    if (!issueNumber) continue
    issues.push({
      issueNumber,
      description: text(row.getCell(descriptionColumn).value),
      equipmentName: equipmentColumn ? text(row.getCell(equipmentColumn).value) : '',
      serialNumber: serialColumn ? text(row.getCell(serialColumn).value) : '',
      sourceUrl: linkColumn ? text(row.getCell(linkColumn).value) : '',
    })
  }
  if (!issues.length) return NextResponse.json({ error: 'No issue rows were found.' }, { status: 400 })

  const result = await upsertLeanIssues(siteId, issues)
  return NextResponse.json({ ...result, serialColumnFound: Boolean(serialColumn) })
}
