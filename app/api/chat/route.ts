import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildPhase1Prompt, buildPhase2Prompt } from '@/lib/prompts'
import type { ChatRequest, ApiResponse } from '@/lib/types'

const MAX_MESSAGES = 50
const MAX_MESSAGE_LENGTH = 4000
const MAX_DOC_VALUE_LENGTH = 2000
const VALID_PHASES = new Set(['phase1', 'phase2', 'done'])
const DOC_KEYS = ['problem', 'target', 'goal', 'requirements', 'nonFunctional', 'completionConditions', 'constraints', 'outOfScope', 'risks', 'techStack']

function validateBody(body: unknown): body is ChatRequest {
  if (!body || typeof body !== 'object') return false
  const b = body as Record<string, unknown>

  if (!Array.isArray(b.messages) || b.messages.length === 0 || b.messages.length > MAX_MESSAGES) return false
  for (const msg of b.messages) {
    if (!msg || typeof msg !== 'object') return false
    const m = msg as Record<string, unknown>
    if (m.role !== 'user' && m.role !== 'assistant') return false
    if (typeof m.content !== 'string' || m.content.length > MAX_MESSAGE_LENGTH) return false
  }

  if (typeof b.phase !== 'string' || !VALID_PHASES.has(b.phase)) return false

  if (typeof b.questionIndex !== 'number' || !Number.isInteger(b.questionIndex) || b.questionIndex < 0 || b.questionIndex > 9) return false

  if (!b.doc || typeof b.doc !== 'object' || Array.isArray(b.doc)) return false
  const doc = b.doc as Record<string, unknown>
  for (const key of DOC_KEYS) {
    if (typeof doc[key] !== 'string' || (doc[key] as string).length > MAX_DOC_VALUE_LENGTH) return false
  }

  return true
}

function extractJson(text: string): ApiResponse {
  const cleaned = text.trim()
  try {
    return JSON.parse(cleaned) as ApiResponse
  } catch {
    const codeBlock = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlock) return JSON.parse(codeBlock[1].trim()) as ApiResponse
    const raw = cleaned.match(/\{[\s\S]*\}/)
    if (raw) return JSON.parse(raw[0]) as ApiResponse
    throw new Error('Cannot parse JSON response')
  }
}

export async function POST(req: NextRequest) {
  try {
    // CSRF: 異なるオリジンからのリクエストを拒否
    const origin = req.headers.get('origin')
    if (origin) {
      const host = req.headers.get('host') ?? ''
      if (!origin.endsWith(`//${host}`)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    if (!validateBody(body)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { messages, phase, questionIndex, doc } = body

    const apiKey = process.env.GEMINI_API_KEY
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite'

    if (!apiKey) {
      return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
    }

    const systemPrompt = phase === 'phase1'
      ? buildPhase1Prompt(questionIndex, doc)
      : buildPhase2Prompt(doc)

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: 'application/json' },
      systemInstruction: systemPrompt,
    })

    const allButLast = messages.slice(0, -1)
    const firstUserIndex = allButLast.findIndex(m => m.role === 'user')
    const history = (firstUserIndex >= 0 ? allButLast.slice(firstUserIndex) : []).map(m => ({
      role: m.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: m.content }],
    }))

    const lastMessage = messages[messages.length - 1]
    const chat = model.startChat({ history })
    const result = await chat.sendMessage(lastMessage.content)
    const responseText = result.response.text()

    try {
      const parsed = extractJson(responseText)
      return NextResponse.json(parsed)
    } catch {
      console.error('AI response JSON parse failed')
      return NextResponse.json(
        { message: 'AIの応答を解析できませんでした。もう一度お試しください。', sectionKey: null, sectionContent: '', nextQuestion: questionIndex, phase },
        { status: 200 }
      )
    }
  } catch {
    console.error('Unexpected API error')
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })
  }
}
