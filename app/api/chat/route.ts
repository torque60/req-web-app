import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { buildPhase1Prompt, buildPhase2Prompt } from '@/lib/prompts'
import type { ChatRequest, ApiResponse } from '@/lib/types'

function extractJson(text: string): ApiResponse {
  const cleaned = text.trim()
  try {
    return JSON.parse(cleaned) as ApiResponse
  } catch {
    const codeBlock = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlock) return JSON.parse(codeBlock[1].trim()) as ApiResponse
    const raw = cleaned.match(/\{[\s\S]*\}/)
    if (raw) return JSON.parse(raw[0]) as ApiResponse
    throw new Error(`Cannot parse JSON: ${cleaned.slice(0, 200)}`)
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json() as ChatRequest
  const { messages, phase, questionIndex, doc } = body

  const apiKey = process.env.GEMINI_API_KEY
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite'

  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not set' }, { status: 500 })
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

  const history = messages.slice(0, -1).map(m => ({
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
  } catch (e) {
    console.error('JSON parse error:', e, '\nRaw:', responseText)
    return NextResponse.json(
      { message: 'AIの応答を解析できませんでした。もう一度お試しください。', sectionKey: null, sectionContent: '', nextQuestion: questionIndex, phase },
      { status: 200 }
    )
  }
}
