'use client'

import { useState, useEffect, useRef } from 'react'
import ChatPane from '@/components/ChatPane'
import DocumentPane from '@/components/DocumentPane'
import type { Message, Phase, RequirementsDoc, ApiResponse } from '@/lib/types'

const INITIAL_DOC: RequirementsDoc = {
  problem: '',
  target: '',
  goal: '',
  requirements: '',
  nonFunctional: '',
  completionConditions: '',
  constraints: '',
  outOfScope: '',
  risks: '',
  techStack: '',
}

const INITIAL_MESSAGE: Message = {
  role: 'assistant',
  content: 'こんにちは！一緒にシステムの企画・要件定義を進めましょう。\n\nまず課題の整理からです。**今どんな困りごとや課題がありますか？** また、なぜ今それを解決しようと思いましたか？アイデアの段階でも大丈夫です！',
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE])
  const [phase, setPhase] = useState<Phase>('phase1')
  const [questionIndex, setQuestionIndex] = useState(0)
  const [doc, setDoc] = useState<RequirementsDoc>(INITIAL_DOC)
  const [isLoading, setIsLoading] = useState(false)
  const [mobileTab, setMobileTab] = useState<'chat' | 'doc'>('chat')

  const phase2Triggered = useRef(false)
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const docRef = useRef(doc)
  docRef.current = doc
  const isLoadingRef = useRef(isLoading)
  isLoadingRef.current = isLoading

  async function callApi(msgs: Message[], ph: Phase, qi: number, d: RequirementsDoc) {
    setIsLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs, phase: ph, questionIndex: qi, doc: d }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data: ApiResponse = await res.json()

      if (data.sectionKey && data.sectionContent) {
        setDoc(prev => ({ ...prev, [data.sectionKey!]: data.sectionContent }))
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.message }])

      if (typeof data.nextQuestion === 'number') {
        setQuestionIndex(data.nextQuestion)
      }

      if (data.phase === 'done') {
        setPhase('done')
      } else if (ph === 'phase1' && data.nextQuestion >= 9) {
        setPhase('phase2')
      }
    } catch (e) {
      console.error('API error:', e)
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'エラーが発生しました。しばらく待ってからお試しください。' },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (phase === 'phase2' && !phase2Triggered.current && !isLoadingRef.current) {
      phase2Triggered.current = true
      const trigger: Message = {
        role: 'user',
        content: '企画・要件定義フェーズが完了しました。技術スタックの選定をお願いします。',
      }
      const newMessages = [...messagesRef.current, trigger]
      setMessages(newMessages)
      callApi(newMessages, 'phase2', 9, docRef.current)
    }
  }, [phase])

  function handleSend(content: string) {
    const newMessages: Message[] = [...messages, { role: 'user', content }]
    setMessages(newMessages)
    callApi(newMessages, phase, questionIndex, doc)
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* モバイル用タブバー（md以上では非表示） */}
      <div className="flex md:hidden shrink-0 bg-white border-b border-gray-200">
        <button
          onClick={() => setMobileTab('chat')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            mobileTab === 'chat'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-gray-500'
          }`}
        >
          チャット
        </button>
        <button
          onClick={() => setMobileTab('doc')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            mobileTab === 'doc'
              ? 'text-indigo-600 border-b-2 border-indigo-600'
              : 'text-gray-500'
          }`}
        >
          ドキュメント
        </button>
      </div>

      {/* メインコンテンツ */}
      <div className="flex flex-1 overflow-hidden">
        {/* チャットペイン: モバイルはタブ切り替え、デスクトップは常時表示40% */}
        <div
          className={`
            flex-col border-gray-200
            ${mobileTab === 'chat' ? 'flex' : 'hidden'}
            md:flex md:w-2/5 md:border-r
            w-full
          `}
        >
          <ChatPane
            messages={messages}
            phase={phase}
            questionIndex={questionIndex}
            isLoading={isLoading}
            onSend={handleSend}
          />
        </div>

        {/* ドキュメントペイン: モバイルはタブ切り替え、デスクトップは常時表示60% */}
        <div
          className={`
            flex-col
            ${mobileTab === 'doc' ? 'flex' : 'hidden'}
            md:flex md:w-3/5
            w-full
          `}
        >
          <DocumentPane doc={doc} phase={phase} />
        </div>
      </div>
    </div>
  )
}
