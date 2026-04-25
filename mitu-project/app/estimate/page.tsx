// ============================================================
// ディレクトリ: mitu-project/app/estimate/
// ファイル名: page.tsx
// バージョン: V4.0.1
// 更新: 2026/04/25
// 変更: 途中保存時のdate・title空チェック追加（コピー編集モードで空保存されるバグ修正）
// ============================================================
'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'

const APP_VERSION = 'V4.0.1'
const DEFAULT_UNITS = ['m2','m','ヶ所','式','台','本','枚','校','人工']
const PRESET_SECTIONS = ['解体工事','内装工事','特殊仮設工事','外部仕上工事','塗装工事','植栽工事','躯体工事']

type PopupItem = {
  id: number
  name1: string; name2: string | null; name3: string | null
  spec1: string | null; spec2: string | null; spec3: string | null
  unit: string | null; unit_price: number | null
  note1: string | null; note2: string | null; note3: string | null
  estimate_id: number
}
type Row = {
  id: string; name1: string; name2: string; name3: string
  spec1: string; spec2: string; spec3: string
  quantity: string; unit: string; unit_price: string; amount: number
  note1: string; note2: string; note3: string
  showCandidates: boolean
  source_estimate_item_id: number | null
}
type Section = { id: string; name: string; rows: Row[] }

function EstimatePage() {
  const params = useSearchParams()
  const router = useRouter()
  const date = params.get('date') || ''
  const building = params.get('building') || ''
  const title = params.get('title') || ''
  const staff = params.get('staff') || ''
  const work_type = params.get('work_type') || ''
  const draft_id = params.get('draft_id') || ''

  const [sections, setSections] = useState<Section[]>([])
  const [customSection, setCustomSection] = useState('')
  const [showSectionInput, setShowSectionInput] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [units, setUnits] = useState<string[]>(DEFAULT_UNITS)
  const [showBackDialog, setShowBackDialog] = useState(false)

  const [popup, setPopup] = useState<{
    sectionId: string; rowId: string; workSection: string; keyword?: string
  } | null>(null)
  const [popupItems, setPopupItems] = useState<PopupItem[]>([])
  const [popupLoading, setPopupLoading] = useState(false)
  const [popupSearch, setPopupSearch] = useState('')

  const mode = !draft_id ? 'new' : !date ? 'copy' : 'draft'
  const modeLabel = mode === 'new' ? '新規作成' : mode === 'copy' ? 'コピー編集中' : '下書き編集中'
  const modeBg = mode === 'new' ? 'bg-gray-500' : mode === 'copy' ? 'bg-orange-500' : 'bg-yellow-500'

  useEffect(() => {
    loadUnits()
    if (draft_id) loadDraft(draft_id)
  }, [])

  const loadUnits = async () => {
    const { data } = await supabase.from('settings').select('value').eq('key','units').single()
    if (data) setUnits(data.value as string[])
  }

  const loadDraft = async (id: string) => {
    const { data } = await supabase.from('drafts').select('sections').eq('id', id).single()
    if (data?.sections) setSections(data.sections as Section[])
  }

  const saveDraft = async () => {
    // ▼ V4.0.1追加: date・title空チェック
    if (!date && !title) {
      setSavedMsg('⚠️ 日付と件名を入力してください')
      setTimeout(() => setSavedMsg(''), 3000)
      return
    }
    if (!date) {
      setSavedMsg('⚠️ 日付を入力してください')
      setTimeout(() => setSavedMsg(''), 3000)
      return
    }
    if (!title) {
      setSavedMsg('⚠️ 件名を入力してください')
      setTimeout(() => setSavedMsg(''), 3000)
      return
    }
    // ▲ V4.0.1追加ここまで
    setSaving(true)
    const file_key = `${date}_${building}_${title}_${staff}_${work_type}`
    const sectionsToSave = sections.map(s => ({
      ...s, rows: s.rows.map(r => ({ ...r, showCandidates: false }))
    }))
    await supabase.from('drafts').upsert({
      file_key, date, building, title, staff, work_type,
      sections: sectionsToSave,
      updated_at: new Date().toISOString()
    }, { onConflict: 'file_key' })
    setSaving(false)
    setSavedMsg('保存しました！')
    setTimeout(() => setSavedMsg(''), 3000)
  }

  const handleBackUpdate = () => {
    setShowBackDialog(false)
    const p = new URLSearchParams({ date, building, title, staff, work_type, ...(draft_id ? { draft_id } : {}) })
    router.push(`/?${p.toString()}&mode=update`)
  }

  const handleBackCopy = async () => {
    setShowBackDialog(false)
    const sectionsToSave = sections.map(s => ({ ...s, rows: s.rows.map(r => ({ ...r, showCandidates: false })) }))
    const file_key = `copy_${Date.now()}`
    const { data } = await supabase.from('drafts').insert({
      file_key, date: '', building, title: '', staff, work_type,
      sections: sectionsToSave,
      updated_at: new Date().toISOString()
    }).select('id').single()
    if (data) {
      const p = new URLSearchParams({ building, staff, work_type, draft_id: String(data.id), mode: 'copy' })
      router.push(`/?${p.toString()}`)
    }
  }

  const handleBackNew = () => {
    setShowBackDialog(false)
    const p = new URLSearchParams({ date, building, title, staff, work_type })
    router.push(`/?${p.toString()}`)
  }

  // ポップアップを開く（📋ボタン or 名称入力）
  const openPopup = async (sectionId: string, rowId: string, sectionName: string, keyword?: string) => {
    setPopup({ sectionId, rowId, workSection: sectionName, keyword })
    setPopupSearch(keyword || '')
    setPopupLoading(true)
    const { data } = await supabase
      .from('estimate_items')
      .select('id,name1,name2,name3,spec1,spec2,spec3,unit,unit_price,note1,note2,note3,estimate_id')
      .eq('work_section', sectionName)
      .not('name1', 'is', null)
      .order('name1')
    setPopupItems(data || [])
    setPopupLoading(false)
  }

  // 名称入力時（2文字以上でポップアップ）
  const handleNameInput = (sectionId: string, rowId: string, sectionName: string, value: string) => {
    updateRow(sectionId, rowId, 'name1', value)
    if (value.length >= 2) {
      openPopup(sectionId, rowId, sectionName, value)
    }
  }

  const selectPopupItem = (item: PopupItem) => {
    if (!popup) return
    setSections(prev => prev.map(s => {
      if (s.id !== popup.sectionId) return s
      return {
        ...s, rows: s.rows.map(r => {
          if (r.id !== popup.rowId) return r
          const unit_price = item.unit_price?.toString() || ''
          const q = parseFloat(r.quantity) || 0
          const p = parseFloat(unit_price) || 0
          return {
            ...r,
            name1: item.name1 || '', name2: item.name2 || '', name3: item.name3 || '',
            spec1: item.spec1 || '', spec2: item.spec2 || '', spec3: item.spec3 || '',
            unit: item.unit || '', unit_price,
            amount: Math.round(q * p * 10) / 10,
            note1: item.note1 || '', note2: item.note2 || '', note3: item.note3 || '',
            source_estimate_item_id: item.id,
            showCandidates: false
          }
        })
      }
    }))
    setPopup(null)
  }

  const filteredPopupItems = popupItems.filter(item => {
    if (!popupSearch) return true
    const kw = popupSearch.toLowerCase()
    return (item.name1 || '').toLowerCase().includes(kw) || (item.spec1 || '').toLowerCase().includes(kw)
  })

  const uniquePopupItems = filteredPopupItems.filter((item, idx, arr) =>
    arr.findIndex(x => x.name1 === item.name1 && x.spec1 === item.spec1) === idx
  )

  const newRow = (): Row => ({
    id: Math.random().toString(36).slice(2),
    name1:'', name2:'', name3:'',
    spec1:'', spec2:'', spec3:'',
    quantity:'', unit:'', unit_price:'', amount:0,
    note1:'', note2:'', note3:'',
    showCandidates:false,
    source_estimate_item_id: null
  })

  const addSection = (name: string) => {
    if (!name.trim()) return
    setSections(prev => [...prev, { id: Math.random().toString(36).slice(2), name, rows: [] }])
    setCustomSection('')
    setShowSectionInput(false)
  }

  const deleteSection = (id: string) => setSections(prev => prev.filter(s => s.id !== id))

  const addRow = (sectionId: string, sectionName: string) => {
    const row = newRow()
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, rows: [...s.rows, row] } : s
    ))
    openPopup(sectionId, row.id, sectionName)
  }

  const deleteRow = (sectionId: string, rowId: string) => {
    setSections(prev => prev.map(s =>
      s.id === sectionId ? { ...s, rows: s.rows.filter(r => r.id !== rowId) } : s
    ))
  }

  const updateRow = (sectionId: string, rowId: string, field: string, value: string) => {
    setSections(prev => prev.map(s => {
      if (s.id !== sectionId) return s
      return {
        ...s, rows: s.rows.map(r => {
          if (r.id !== rowId) return r
          const updated = { ...r, [field]: value }
          const q = parseFloat(updated.quantity) || 0
          const p = parseFloat(updated.unit_price) || 0
          updated.amount = Math.round(q * p * 10) / 10
          return updated
        })
      }
    }))
  }

  const subtotal = (s: Section) => s.rows.reduce((sum, r) => sum + r.amount, 0)
  const grandTotal = sections.reduce((sum, s) => sum + subtotal(s), 0)

  const handleExport = async () => {
    await saveDraft()
    const res = await fetch('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, building, title, staff, work_type, sections })
    })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${date.replace(/-/g,'')}_${building}_${title}_${staff}_${work_type}.xlsx`
    a.click()
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">

        {/* ヘッダー */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => setShowBackDialog(true)}
            className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium text-sm">
            ← 戻る
          </button>
          <h1 className="text-xl font-bold text-gray-800">明細入力</h1>
          <span className={`text-xs text-white px-2 py-0.5 rounded ${modeBg}`}>{modeLabel}</span>
          <span className="ml-auto text-xs text-gray-400">{APP_VERSION}</span>
        </div>

        {/* 案件情報 */}
        <div className="bg-white rounded p-3 mb-4 text-sm text-gray-600 flex gap-4 flex-wrap">
          <span>{date || '📅 日付を入力してください'}</span>
          <span>{building}</span>
          <span className="font-medium">{title || '📝 件名を入力してください'}</span>
          <span>{staff}</span>
          <span>{work_type}</span>
        </div>

        {/* 工事区分ごとの明細 */}
        {sections.map(section => (
          <div key={section.id} className="mb-6">
            <div className="flex items-center justify-between bg-blue-800 text-white px-4 py-2 rounded-t">
              <h2 className="text-lg font-bold">{section.name}</h2>
              <button onClick={() => deleteSection(section.id)} className="text-blue-200 hover:text-white text-sm">× 削除</button>
            </div>
            <div className="bg-white border border-t-0 rounded-b overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left w-8"></th>
                    <th className="p-2 text-left w-44">名称</th>
                    <th className="p-2 text-left w-36">仕様</th>
                    <th className="p-2 text-right w-16">数量</th>
                    <th className="p-2 text-left w-16">単位</th>
                    <th className="p-2 text-right w-20">単価</th>
                    <th className="p-2 text-right w-22">金額</th>
                    <th className="p-2 text-left w-28">備考</th>
                    <th className="p-2 w-6"></th>
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map(row => (
                    <tr key={row.id} className="border-t align-top">
                      <td className="p-1 pt-2">
                        <button
                          onClick={() => openPopup(section.id, row.id, section.name)}
                          className="w-7 h-7 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded text-sm"
                          title="品目選択">📋</button>
                      </td>
                      <td className="p-1">
                        <input className="w-full border rounded px-2 py-1 mb-1" value={row.name1} placeholder="名称1段目"
                          onChange={e => handleNameInput(section.id, row.id, section.name, e.target.value)} />
                        <input className="w-full border rounded px-2 py-1 mb-1" value={row.name2} placeholder="名称2段目"
                          onChange={e => updateRow(section.id, row.id, 'name2', e.target.value)} />
                        <input className="w-full border rounded px-2 py-1" value={row.name3} placeholder="名称3段目"
                          onChange={e => updateRow(section.id, row.id, 'name3', e.target.value)} />
                      </td>
                      <td className="p-1">
                        <input className="w-full border rounded px-2 py-1 mb-1" value={row.spec1} placeholder="仕様1段目"
                          onChange={e => updateRow(section.id, row.id, 'spec1', e.target.value)} />
                        <input className="w-full border rounded px-2 py-1 mb-1" value={row.spec2} placeholder="仕様2段目"
                          onChange={e => updateRow(section.id, row.id, 'spec2', e.target.value)} />
                        <input className="w-full border rounded px-2 py-1" value={row.spec3} placeholder="仕様3段目"
                          onChange={e => updateRow(section.id, row.id, 'spec3', e.target.value)} />
                      </td>
                      <td className="p-1">
                        <input className="w-full border rounded px-2 py-1 text-right" value={row.quantity} type="number" step="0.1"
                          onChange={e => updateRow(section.id, row.id, 'quantity', e.target.value)} />
                      </td>
                      <td className="p-1">
                        <select className="w-full border rounded px-1 py-1 mb-1" value={row.unit}
                          onChange={e => updateRow(section.id, row.id, 'unit', e.target.value)}>
                          <option value="">選択</option>
                          {units.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                        <input className="w-full border rounded px-2 py-1 text-xs" value={row.unit} placeholder="自由入力"
                          onChange={e => updateRow(section.id, row.id, 'unit', e.target.value)} />
                      </td>
                      <td className="p-1">
                        <input className="w-full border rounded px-2 py-1 text-right" value={row.unit_price} type="number"
                          onChange={e => updateRow(section.id, row.id, 'unit_price', e.target.value)} />
                        {row.source_estimate_item_id && (
                          <div className="text-gray-300 text-xs text-right mt-1">#{row.source_estimate_item_id}</div>
                        )}
                      </td>
                      <td className="p-1 text-right pr-2 pt-2">{row.amount.toLocaleString()}</td>
                      <td className="p-1">
                        <input className="w-full border rounded px-2 py-1 mb-1" value={row.note1} placeholder="備考1段目"
                          onChange={e => updateRow(section.id, row.id, 'note1', e.target.value)} />
                        <input className="w-full border rounded px-2 py-1 mb-1" value={row.note2} placeholder="備考2段目"
                          onChange={e => updateRow(section.id, row.id, 'note2', e.target.value)} />
                        <input className="w-full border rounded px-2 py-1" value={row.note3} placeholder="備考3段目"
                          onChange={e => updateRow(section.id, row.id, 'note3', e.target.value)} />
                      </td>
                      <td className="p-1 pt-2">
                        <button onClick={() => deleteRow(section.id, row.id)} className="text-red-400 hover:text-red-600 text-lg">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-2 flex justify-between items-center border-t">
                <button onClick={() => addRow(section.id, section.name)} className="text-blue-600 hover:text-blue-800 text-sm">+ 行追加</button>
                <div className="text-sm font-medium">小計: {subtotal(section).toLocaleString()} 円</div>
              </div>
            </div>
          </div>
        ))}

        {/* 工事区分追加 */}
        <div className="mb-6">
          {!showSectionInput ? (
            <button onClick={() => setShowSectionInput(true)}
              className="w-full border-2 border-dashed border-blue-300 text-blue-600 py-3 rounded-lg hover:bg-blue-50">
              + 工事区分を追加
            </button>
          ) : (
            <div className="bg-white rounded-lg border p-4">
              <p className="text-sm font-medium text-gray-700 mb-2">工事区分を選択または入力</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {PRESET_SECTIONS.filter(p => !sections.find(s => s.name === p)).map(p => (
                  <button key={p} onClick={() => addSection(p)}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm">{p}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <input className="flex-1 border rounded px-3 py-2 text-sm" value={customSection} placeholder="その他（自由入力）"
                  onChange={e => setCustomSection(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addSection(customSection)} />
                <button onClick={() => addSection(customSection)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">追加</button>
                <button onClick={() => setShowSectionInput(false)} className="text-gray-500 px-3 py-2 text-sm">キャンセル</button>
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="bg-white rounded p-4 flex justify-between items-center sticky bottom-4 shadow-lg">
          <div className="text-xl font-bold">合計: {grandTotal.toLocaleString()} 円</div>
          <div className="flex gap-3 items-center">
            {savedMsg && <span className="text-green-600 text-sm">{savedMsg}</span>}
            <button onClick={saveDraft} disabled={saving}
              className="bg-yellow-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-yellow-600 disabled:opacity-50">
              {saving ? '保存中...' : '途中保存'}
            </button>
            <button onClick={handleExport}
              className="bg-green-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-green-700">
              Excelダウンロード
            </button>
          </div>
        </div>
      </div>

      {/* 戻るダイアログ */}
      {showBackDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">どのように戻りますか？</h3>
            <p className="text-sm text-gray-500 mb-6">現在の明細：{sections.reduce((s,sec)=>s+sec.rows.length,0)}行</p>
            <div className="space-y-3">
              <button onClick={handleBackUpdate}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 text-left px-4">
                <div className="font-medium">変更</div>
                <div className="text-xs opacity-80">同じ件名で案件情報を修正する</div>
              </button>
              <button onClick={handleBackCopy}
                className="w-full bg-orange-500 text-white py-3 rounded-lg font-medium hover:bg-orange-600 text-left px-4">
                <div className="font-medium">明細コピー編集</div>
                <div className="text-xs opacity-80">この明細を別件名でコピーして使う</div>
              </button>
              <button onClick={handleBackNew}
                className="w-full bg-gray-500 text-white py-3 rounded-lg font-medium hover:bg-gray-600 text-left px-4">
                <div className="font-medium">新規</div>
                <div className="text-xs opacity-80">明細を空にして新しく作る</div>
              </button>
              <button onClick={() => setShowBackDialog(false)}
                className="w-full border border-gray-300 text-gray-600 py-2 rounded-lg text-sm hover:bg-gray-50">
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 品目選択ポップアップ */}
      {popup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b bg-blue-800 rounded-t-lg">
              <h3 className="text-white font-bold">品目選択 - {popup.workSection}</h3>
              <button onClick={() => setPopup(null)} className="text-white hover:text-blue-200 text-xl">×</button>
            </div>
            <div className="p-3 border-b">
              <input className="w-full border rounded px-3 py-2 text-sm" placeholder="名称・仕様で絞り込み"
                value={popupSearch} onChange={e => setPopupSearch(e.target.value)} autoFocus />
            </div>
            <div className="overflow-y-auto flex-1">
              {popupLoading ? (
                <div className="p-8 text-center text-gray-400">読み込み中...</div>
              ) : uniquePopupItems.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  {popupSearch ? '該当する品目がありません' : 'このカテゴリの品目データがありません'}
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">名称</th>
                      <th className="p-2 text-left">仕様</th>
                      <th className="p-2 text-left w-12">単位</th>
                      <th className="p-2 text-right w-20">単価</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uniquePopupItems.map(item => (
                      <tr key={item.id} className="border-t hover:bg-blue-50 cursor-pointer"
                        onClick={() => selectPopupItem(item)}>
                        <td className="p-2">
                          <div>{item.name1}</div>
                          {item.name2 && <div className="text-gray-400">{item.name2}</div>}
                          {item.name3 && <div className="text-gray-400">{item.name3}</div>}
                        </td>
                        <td className="p-2 text-gray-500">
                          <div>{item.spec1}</div>
                          {item.spec2 && <div>{item.spec2}</div>}
                        </td>
                        <td className="p-2">{item.unit}</td>
                        <td className="p-2 text-right font-medium">
                          {item.unit_price ? item.unit_price.toLocaleString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-4 py-2 border-t text-xs text-gray-400 text-right">
              {uniquePopupItems.length}件表示
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default function Page() {
  return <Suspense><EstimatePage /></Suspense>
}
