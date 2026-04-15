'use client'
import { useState, useCallback, useRef } from 'react'
import { Upload, X, Check, AlertTriangle, FileText, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, Spinner } from '@/components/shared/primitives'
import { useApiCall } from '@/hooks'

interface ImportModalProps {
  campaignId: string
  onClose:    () => void
  onImported: (count: number) => void
}

type ImportStep = 'upload' | 'preview' | 'importing' | 'done'

// ── Expected CSV column names (groundworks dataset) ────────
const REQUIRED_COLS = ['prospect_full_name', 'prospect_linkedin']
const OPTIONAL_COLS = ['prospect_job_title', 'prospect_company_name', 'prospect_first_name',
  'prospect_last_name', 'prospect_region_name', 'prospect_city',
  'contact_professions_email', 'prospect_skills', 'prospect_experience']

interface ParsedRow {
  full_name:    string
  linkedin_url: string
  job_title?:   string
  company?:     string
  email?:       string
  city?:        string
  region?:      string
  [key: string]: unknown
}

interface ParseResult {
  rows:       Record<string, string>[]
  headers:    string[]
  isKnown:    boolean  // groundworks dataset format
  total:      number
  withEmail:  number
  errors:     string[]
}

export function ImportModal({ campaignId, onClose, onImported }: ImportModalProps) {
  const call    = useApiCall()
  const fileRef = useRef<HTMLInputElement>(null)

  const [step, setStep]         = useState<ImportStep>('upload')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed]     = useState<ParseResult | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult]     = useState<{ imported: number; duplicates: number; errors: string[] } | null>(null)
  const [error, setError]       = useState<string | null>(null)

  // ── Parse CSV in browser ──────────────────────────────────

  function parseCSV(text: string): ParseResult {
    const lines   = text.trim().split('\n')
    const headers = parseCSVLine(lines[0])

    const isKnown = headers.includes('prospect_linkedin') && headers.includes('prospect_full_name')

    const rows: Record<string, string>[] = []
    const errors: string[] = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue
      const values = parseCSVLine(line)
      const row: Record<string, string> = {}
      headers.forEach((h, j) => { row[h] = values[j] ?? '' })

      if (isKnown) {
        if (!row.prospect_full_name?.trim()) { errors.push(`Row ${i}: missing name`); continue }
        if (!row.prospect_linkedin?.trim())  { errors.push(`Row ${i}: missing LinkedIn URL`); continue }
      } else {
        if (!row.full_name?.trim() && !row['Full Name']?.trim()) {
          errors.push(`Row ${i}: missing name`)
          continue
        }
      }

      rows.push(row)
    }

    const withEmail = rows.filter(r =>
      r.contact_professions_email?.trim() ||
      r.email?.trim()
    ).length

    return { rows, headers, isKnown, total: rows.length, withEmail, errors }
  }

  function parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    result.push(current.trim())
    return result
  }

  // ── File handling ─────────────────────────────────────────

  function handleFile(file: File) {
    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      setError('Please upload a CSV file')
      return
    }
    setFileName(file.name)
    setError(null)

    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      try {
        const result = parseCSV(text)
        setParsed(result)
        setStep('preview')
      } catch (err: any) {
        setError(`Failed to parse CSV: ${err.message}`)
      }
    }
    reader.readAsText(file)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  // ── Import ────────────────────────────────────────────────

  async function startImport() {
    if (!parsed) return
    setStep('importing')
    setProgress({ done: 0, total: parsed.total })

    // Split into batches of 50
    const BATCH = 50
    let totalImported = 0
    let totalDuplicates = 0
    const allErrors: string[] = []

    for (let i = 0; i < parsed.rows.length; i += BATCH) {
      const batch = parsed.rows.slice(i, i + BATCH)

      try {
        const res = await call('/api/leads/import', {
          method: 'POST',
          body: JSON.stringify({ campaign_id: campaignId, leads: batch }),
        })
        totalImported   += res.imported ?? 0
        totalDuplicates += res.duplicates ?? 0
        if (res.errors) allErrors.push(...res.errors)
      } catch (err: any) {
        allErrors.push(`Batch ${i}–${i + BATCH}: ${err.message}`)
      }

      setProgress({ done: Math.min(i + BATCH, parsed.total), total: parsed.total })
      // Small delay between batches to avoid hammering the API
      await new Promise(r => setTimeout(r, 200))
    }

    setResult({ imported: totalImported, duplicates: totalDuplicates, errors: allErrors })
    setStep('done')
  }

  // ── Preview rows ──────────────────────────────────────────

  function getPreviewRows(): ParsedRow[] {
    if (!parsed) return []
    return parsed.rows.slice(0, 8).map(row => {
      if (parsed.isKnown) {
        return {
          full_name:    row.prospect_full_name,
          linkedin_url: row.prospect_linkedin,
          job_title:    row.prospect_job_title,
          company:      row.prospect_company_name,
          email:        row.contact_professions_email,
          city:         row.prospect_city,
          region:       row.prospect_region_name,
        }
      }
      return {
        full_name:    row.full_name || row['Full Name'] || '',
        linkedin_url: row.linkedin_url || row['LinkedIn URL'] || '',
        job_title:    row.job_title || row['Job Title'],
        company:      row.company || row['Company'],
        email:        row.email || row['Email'],
      }
    })
  }

  // ── Render ────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 dark:bg-black/50 z-50 animate-fade-in" onClick={onClose} />

      {/* Modal */}
      <div
        className={cn(
          'fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
          'bg-white dark:bg-gray-900 rounded-2xl shadow-modal flex flex-col',
          'animate-scale-in',
        )}
        style={{ width: 560, maxHeight: '85vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div>
            <h2 className="font-bold text-gray-900 dark:text-white text-lg">Import Leads</h2>
            <p className="text-xs text-gray-400 mt-0.5">Upload a CSV — groundworks format auto-detected</p>
          </div>
          {step !== 'importing' && (
            <button onClick={onClose} className="btn btn-ghost btn-icon text-gray-400">
              <X size={15} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Step: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={cn(
                  'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-150',
                  dragging
                    ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800/40',
                )}
              >
                <Upload size={28} className="mx-auto mb-3 text-gray-300" />
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  Drop your CSV here or <span className="text-brand-500">click to browse</span>
                </p>
                <p className="text-xs text-gray-400 mt-1.5">
                  Supports the uk_groundworks_civil_eng_merged.csv format
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2.5">
                  <AlertTriangle size={13} />
                  {error}
                </div>
              )}

              {/* Format reference */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">
                  Expected columns (groundworks format)
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {['prospect_full_name ✓', 'prospect_linkedin ✓', 'prospect_job_title', 'prospect_company_name',
                    'contact_professions_email', 'prospect_city', 'prospect_skills', 'prospect_experience'].map(col => (
                    <span key={col} className="text-xs font-mono text-gray-500 dark:text-gray-400">
                      {col}
                    </span>
                  ))}
                </div>
                <p className="text-2xs text-gray-400 mt-2">✓ = required · others become enrichment data</p>
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && parsed && (
            <div className="space-y-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Leads found',  value: parsed.total,      color: 'text-brand-600' },
                  { label: 'With email',   value: parsed.withEmail,  color: 'text-green-600' },
                  { label: 'Parse errors', value: parsed.errors.length, color: parsed.errors.length > 0 ? 'text-amber-600' : 'text-gray-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3 text-center">
                    <p className={cn('text-xl font-black', color)}>{value}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Format detection */}
              <div className={cn(
                'flex items-center gap-2 text-xs px-3 py-2 rounded-lg',
                parsed.isKnown
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                  : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400',
              )}>
                <FileText size={12} />
                {parsed.isKnown
                  ? '✓ UK Groundworks dataset format detected — all 25 columns will be imported'
                  : 'Generic CSV format — standard columns will be mapped'}
              </div>

              {/* Preview table */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                  Preview (first 8 rows)
                </p>
                <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800">
                        {['Name', 'Title', 'Company', 'Email'].map(h => (
                          <th key={h} className="text-left px-3 py-2 font-semibold text-gray-400 uppercase tracking-wide text-2xs">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {getPreviewRows().map((row, i) => (
                        <tr key={i} className="border-t border-gray-50 dark:border-gray-800">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Avatar name={row.full_name || '?'} size={22} />
                              <span className="font-medium text-gray-700 dark:text-gray-200 truncate max-w-[100px]">
                                {row.full_name || '—'}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400 truncate max-w-[120px]">
                            {row.job_title || '—'}
                          </td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400 truncate max-w-[100px]">
                            {row.company || '—'}
                          </td>
                          <td className="px-3 py-2">
                            {row.email ? (
                              <span className="text-green-500 font-medium">✓</span>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsed.total > 8 && (
                    <div className="text-center py-2 text-xs text-gray-400 border-t border-gray-50 dark:border-gray-800">
                      +{parsed.total - 8} more leads
                    </div>
                  )}
                </div>
              </div>

              {/* Parse errors */}
              {parsed.errors.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">
                    {parsed.errors.length} rows will be skipped
                  </p>
                  {parsed.errors.slice(0, 3).map((e, i) => (
                    <p key={i} className="text-xs text-amber-500">{e}</p>
                  ))}
                  {parsed.errors.length > 3 && (
                    <p className="text-xs text-amber-400 mt-0.5">…and {parsed.errors.length - 3} more</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step: Importing */}
          {step === 'importing' && (
            <div className="py-8 text-center space-y-4">
              <Spinner size={32} className="mx-auto" />
              <div>
                <p className="font-semibold text-gray-800 dark:text-gray-100 mb-1">
                  Importing {progress.total} leads…
                </p>
                <p className="text-sm text-gray-400">{progress.done} / {progress.total} processed</p>
              </div>
              {/* Progress bar */}
              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 rounded-full transition-all duration-300"
                  style={{ width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">
                Connection requests will be scheduled automatically with AI personalisation
              </p>
            </div>
          )}

          {/* Step: Done */}
          {step === 'done' && result && (
            <div className="py-6 text-center space-y-4">
              <div className="w-14 h-14 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto">
                <Check size={24} className="text-green-500" />
              </div>
              <div>
                <p className="font-bold text-xl text-gray-900 dark:text-white mb-1">
                  {result.imported} leads imported!
                </p>
                {result.duplicates > 0 && (
                  <p className="text-sm text-gray-400">{result.duplicates} duplicates skipped</p>
                )}
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 text-left space-y-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">What happens next:</p>
                {[
                  'Connection requests are queued with AI-personalised notes',
                  'The VPS worker will send them during working hours (9am–6pm)',
                  'Pacing: max 15 connections / day with Gaussian jitter',
                  'Stage updates will appear on your board in real time',
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <ChevronRight size={11} className="text-brand-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-gray-500 dark:text-gray-400">{step}</p>
                  </div>
                ))}
              </div>

              {result.errors.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 text-left">
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                    {result.errors.length} errors
                  </p>
                  {result.errors.slice(0, 3).map((e, i) => (
                    <p key={i} className="text-xs text-amber-500">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        {step !== 'importing' && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 flex gap-3 flex-shrink-0">
            {step === 'upload' && (
              <>
                <button onClick={onClose} className="btn btn-secondary">Cancel</button>
                <div className="flex-1" />
              </>
            )}
            {step === 'preview' && (
              <>
                <button onClick={() => setStep('upload')} className="btn btn-secondary">Back</button>
                <div className="flex-1" />
                <button onClick={startImport} className="btn btn-primary gap-2">
                  Import {parsed?.total} leads
                  <ChevronRight size={13} />
                </button>
              </>
            )}
            {step === 'done' && (
              <button
                onClick={() => onImported(result?.imported ?? 0)}
                className="btn btn-primary flex-1 justify-center"
              >
                Go to board
              </button>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// Check icon helper
function Check({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="2,7 6,11 12,3" />
    </svg>
  )
}
