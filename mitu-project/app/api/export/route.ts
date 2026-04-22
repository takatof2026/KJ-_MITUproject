export const runtime = 'nodejs'
import { NextRequest, NextResponse } from 'next/server'
import ExcelJS from 'exceljs'

const FONT = 'BIZ UDゴシック'
const DATA_ROWS_PER_PAGE = 54
const SUBTOTAL_ROWS = 7
const THIN = { style: 'thin' as const }
const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN }

export async function POST(req: NextRequest) {
  const { date, building, title, staff, work_type, sections } = await req.json()
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('建築')
  ws.columns = [
    { width: 2.33 }, { width: 2.33 }, { width: 18.78 }, { width: 22.78 },
    { width: 9.33 }, { width: 3.78 }, { width: 10.78 }, { width: 11.78 }, { width: 11.78 }
  ]

  let r = 1
  let pageNum = 10
  let dataRowsInPage = 0

  const f = (size: number) => ({ name: FONT, size })

  const setBorder = (row: ExcelJS.Row) => {
    for (let i = 2; i <= 9; i++) { row.getCell(i).border = BORDER }
  }

  const addPageBreak = () => {
    const pRow = ws.getRow(r)
    pRow.getCell(9).value = 'P.  ' + pageNum
    pRow.getCell(9).font = f(10)
    pRow.height = 15.95
    r++
    ws.getRow(r).height = 15.95
    r++
    pageNum++
    dataRowsInPage = 0
  }

  const addPageHeader = () => {
    ws.getRow(r).height = 15.95
    r++
    const h = ws.getRow(r)
    h.getCell(3).value = '名　　　称　・　仕　　　様'
    h.getCell(5).value = '数　量'
    h.getCell(6).value = '単位'
    h.getCell(7).value = '単　価'
    h.getCell(8).value = '金　額'
    h.getCell(9).value = '備　考'
    h.height = 26.1
    ;[3,5,6,7,8,9].forEach(i => { h.getCell(i).font = f(10) })
    setBorder(h)
    r++
  }

  const ensureSpace = (needed: number) => {
    if (dataRowsInPage + needed > DATA_ROWS_PER_PAGE) {
      while (dataRowsInPage < DATA_ROWS_PER_PAGE) {
        const er = ws.getRow(r)
        er.height = 36
        setBorder(er)
        r++
        dataRowsInPage++
      }
      addPageBreak()
      addPageHeader()
    }
  }

  const getSectionTotal = (section: any) => {
    const sub = section.rows.reduce((s: number, row: any) => s + (row.amount || 0), 0)
    return sub + Math.round(sub * 0.07) + Math.round(sub * 0.02) + Math.round(sub * 0.10)
  }

  // === ページ1: サマリー ===
  ws.getRow(r).height = 15.95
  r++
  const h2 = ws.getRow(r)
  h2.getCell(3).value = '名　　　称　・　仕　　　様'
  h2.getCell(5).value = '数　量'
  h2.getCell(6).value = '単位'
  h2.getCell(7).value = '単　価'
  h2.getCell(8).value = '金　額'
  h2.getCell(9).value = '備　考'
  h2.height = 26.1
  ;[3,5,6,7,8,9].forEach(i => { h2.getCell(i).font = f(10) })
  setBorder(h2)
  r++
  const tRow = ws.getRow(r)
  tRow.getCell(2).value = 'Ⅱ'
  tRow.getCell(3).value = '建築工事'
  tRow.height = 36
  ;[2,3].forEach(i => { tRow.getCell(i).font = f(10) })
  setBorder(tRow)
  r++
  const naiRow = ws.getRow(r)
  naiRow.getCell(3).value = '（内訳）'
  naiRow.getCell(3).font = f(10)
  naiRow.height = 36
  setBorder(naiRow)
  r++
  const emRow = ws.getRow(r)
  emRow.height = 36
  setBorder(emRow)
  r++
  sections.forEach((section: any, idx: number) => {
    const sr = ws.getRow(r)
    sr.getCell(2).value = idx + 1
    sr.getCell(3).value = section.name
    sr.getCell(5).value = 1
    sr.getCell(6).value = '式'
    sr.getCell(8).value = Math.round(getSectionTotal(section))
    sr.height = 36
    ;[2,3,5,6,8].forEach(i => { sr.getCell(i).font = f(10) })
    setBorder(sr)
    r++
  })
  const grandTotal = sections.reduce((s: number, sec: any) => s + getSectionTotal(sec), 0)
  const gtRow = ws.getRow(r)
  gtRow.getCell(4).value = 'Ⅱ- 建築工事の計'
  gtRow.getCell(8).value = Math.round(grandTotal)
  gtRow.height = 36
  ;[4,8].forEach(i => { gtRow.getCell(i).font = f(10) })
  setBorder(gtRow)
  r++
  while (r <= 57) {
    const fr = ws.getRow(r)
    fr.height = 36
    setBorder(fr)
    r++
  }
  addPageBreak()
  addPageHeader()

  // === ページ2以降: 各工事区分明細 ===
  sections.forEach((section: any, sIdx: number) => {
    ensureSpace(2)
    const sh = ws.getRow(r)
    sh.getCell(2).value = sIdx + 1
    sh.getCell(3).value = section.name
    sh.height = 36
    ;[2,3].forEach(i => { sh.getCell(i).font = f(10) })
    setBorder(sh)
    r++
    dataRowsInPage++

    section.rows.forEach((row: any) => {
      ensureSpace(1)
      const name = [row.name1, row.name2, row.name3].filter(Boolean).join('\n')
      const spec = [row.spec1, row.spec2, row.spec3].filter(Boolean).join('\n')
      const note = [row.note1, row.note2, row.note3].filter(Boolean).join('\n')
      const dr = ws.getRow(r)
      dr.getCell(3).value = name
      dr.getCell(3).alignment = { wrapText: true, vertical: 'top' }
      dr.getCell(3).font = f(10)
      dr.getCell(4).value = spec
      dr.getCell(4).alignment = { wrapText: true, vertical: 'top' }
      dr.getCell(4).font = f(9)
      dr.getCell(5).value = parseFloat(row.quantity) || null
      dr.getCell(5).font = f(10)
      dr.getCell(6).value = row.unit || ''
      dr.getCell(6).font = f(10)
      dr.getCell(7).value = parseFloat(row.unit_price) || null
      dr.getCell(7).font = f(10)
      dr.getCell(8).value = Math.round((parseFloat(row.quantity) || 0) * (parseFloat(row.unit_price) || 0))
      dr.getCell(8).font = f(10)
      dr.getCell(9).value = note
      dr.getCell(9).alignment = { wrapText: true, vertical: 'top' }
      dr.getCell(9).font = f(9)
      dr.height = 36
      setBorder(dr)
      r++
      dataRowsInPage++
    })

    ensureSpace(SUBTOTAL_ROWS)
    const subtotal = section.rows.reduce((s: number, row: any) => s + (row.amount || 0), 0)
    const stRow = ws.getRow(r)
    stRow.getCell(4).value = '小計'
    stRow.getCell(8).value = Math.round(subtotal)
    stRow.height = 36
    ;[4,8].forEach(i => { stRow.getCell(i).font = f(10) })
    setBorder(stRow)
    r++
    dataRowsInPage++
    const keihi = Math.round(subtotal * 0.07)
    const unban = Math.round(subtotal * 0.02)
    const genba = Math.round(subtotal * 0.10)
    const expenses: [string, number][] = [
      ['仮設工事費', keihi], ['運搬費', unban], ['深夜作業割増', 0], ['現場経費', genba]
    ]
    expenses.forEach(([name, val]) => {
      const er = ws.getRow(r)
      er.getCell(3).value = name
      er.getCell(5).value = 1
      er.getCell(6).value = '式'
      er.getCell(8).value = val
      er.height = 36
      ;[3,5,6,8].forEach(i => { er.getCell(i).font = f(10) })
      setBorder(er)
      r++
      dataRowsInPage++
    })
    const sectionTotal = subtotal + keihi + unban + genba
    const secTotalRow = ws.getRow(r)
    secTotalRow.getCell(4).value = (sIdx + 1) + '- ' + section.name + 'の計'
    secTotalRow.getCell(8).value = Math.round(sectionTotal)
    secTotalRow.height = 36
    ;[4,8].forEach(i => { secTotalRow.getCell(i).font = f(10) })
    setBorder(secTotalRow)
    r++
    dataRowsInPage++
    for (let i = 0; i < 2; i++) {
      const br = ws.getRow(r)
      br.height = 36
      setBorder(br)
      r++
      dataRowsInPage++
    }
  })

  while (dataRowsInPage < DATA_ROWS_PER_PAGE) {
    const fr = ws.getRow(r)
    fr.height = 36
    setBorder(fr)
    r++
    dataRowsInPage++
  }
  addPageBreak()

  const arrayBuffer = await wb.xlsx.writeBuffer()
  const buffer = Buffer.from(new Uint8Array(arrayBuffer))
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="estimate.xlsx"'
    }
  })
}
