'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { RequirementsDoc, Phase } from '@/lib/types'

interface DocumentPaneProps {
  doc: RequirementsDoc
  phase: Phase
}

const SECTIONS: { key: keyof RequirementsDoc; label: string }[] = [
  { key: 'problem',              label: '課題・背景' },
  { key: 'target',               label: 'ターゲット・ステークホルダー' },
  { key: 'goal',                 label: 'ゴール・成功指標' },
  { key: 'requirements',         label: '機能・要件' },
  { key: 'nonFunctional',        label: '非機能要件' },
  { key: 'completionConditions', label: '完了条件・受け入れ条件' },
  { key: 'constraints',          label: '制約・依存関係' },
  { key: 'outOfScope',           label: 'スコープ外・将来バックログ' },
  { key: 'risks',                label: 'リスク・懸念事項' },
  { key: 'techStack',            label: '技術スタック' },
]

function buildMarkdown(doc: RequirementsDoc): string {
  const today = new Date().toISOString().slice(0, 10)
  const lines: string[] = [`# 企画書 / 要件定義書`, `_作成日: ${today}_`, '']

  for (const { key, label } of SECTIONS) {
    lines.push(`## ${label}`)
    lines.push(doc[key] || '_（未入力）_')
    lines.push('')
  }

  return lines.join('\n')
}

function downloadMarkdown(doc: RequirementsDoc) {
  const content = buildMarkdown(doc)
  const blob = new Blob([content], { type: 'text/markdown; charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `project_plan_${new Date().toISOString().slice(0, 10)}.md`
  a.click()
  URL.revokeObjectURL(url)
}

export default function DocumentPane({ doc, phase }: DocumentPaneProps) {
  const filledCount = SECTIONS.filter(s => !!doc[s.key]).length
  const progress = Math.round((filledCount / SECTIONS.length) * 100)

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="px-6 py-3 border-b border-gray-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-gray-700">企画書 / 要件定義書</h2>
          <span className="text-xs text-gray-400">{filledCount} / {SECTIONS.length} セクション</span>
        </div>
        <button
          onClick={() => downloadMarkdown(doc)}
          disabled={filledCount === 0}
          className="px-3 py-1.5 text-xs font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          .md ダウンロード
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100 shrink-0">
        <div
          className="h-full bg-indigo-500 transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Document content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="markdown-doc max-w-2xl mx-auto">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {buildMarkdown(doc)}
          </ReactMarkdown>
        </div>

        {phase === 'done' && (
          <div className="max-w-2xl mx-auto mt-6 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            企画・要件定義が完了しました。上の「.md ダウンロード」ボタンで保存できます。
          </div>
        )}
      </div>
    </div>
  )
}
