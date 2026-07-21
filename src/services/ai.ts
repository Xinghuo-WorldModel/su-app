import { db } from './db'

const SYSTEM_PROMPT = `你是一位专业、温暖的恋爱顾问。你的目标是帮助用户推进和维护与心仪对象的关系。

核心原则：
1. 始终以"推进关系、维护关系"为导向，绝不给出可能破坏关系的建议
2. 充分考虑对方的感受和边界，避免任何 PUA 或过度追求的建议
3. 基于用户提供的具体信息给出个性化、可操作的建议
4. 适时提醒用户关注自身成长，保持健康的心态
5. 如果用户描述的情况暗示对方不感兴趣，温和地帮助用户认清现实

以下是你掌握的关于用户心仪对象的信息：
{KNOWLEDGE}

请基于以上信息，为用户提供贴心、具体的建议。回答要自然、有温度，像一个懂你的朋友在和你聊天。`

async function buildKnowledgeContext(): Promise<string> {
  const entries = await db.getKnowledge()
  const profile = await db.getProfile()

  const parts: string[] = []
  if (profile.name) {
    parts.push(`[基础档案] 名字: ${profile.name}`)
    if (profile.age) parts.push(`[基础档案] 年龄: ${profile.age}`)
    if (profile.occupation) parts.push(`[基础档案] 职业: ${profile.occupation}`)
    if (profile.hobbies) parts.push(`[基础档案] 兴趣爱好: ${profile.hobbies}`)
    if (profile.personality) parts.push(`[基础档案] 性格特点: ${profile.personality}`)
    if (profile.notes) parts.push(`[基础档案] 备注: ${profile.notes}`)
  }

  const categoryMap: Record<string, string> = {
    profile: '基础信息', event: '关系事件', chat: '聊天记录', preference: '偏好/雷区'
  }
  for (const entry of entries) {
    const label = categoryMap[entry.category] || entry.category
    parts.push(`[${label}] ${entry.content}`)
  }

  if (parts.length === 0) {
    return '（暂无录入信息，请提醒用户可以在知识库中添加心仪对象的相关信息，这样你能给出更精准的建议）'
  }
  return parts.join('\n')
}

export async function getApiKey(): Promise<string> {
  const stored = await db.getSetting('apiKey')
  if (stored) return stored
  return import.meta.env.VITE_KIMI_API_KEY || ''
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>
}

export async function* streamChat(
  userMessages: ChatMessage[],
  signal?: AbortSignal
): AsyncGenerator<string> {
  const apiKey = await getApiKey()
  if (!apiKey) throw new Error('请先在设置中填入 Kimi API Key')

  const knowledge = await buildKnowledgeContext()
  const systemPrompt = SYSTEM_PROMPT.replace('{KNOWLEDGE}', knowledge)

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...userMessages,
  ]

  const response = await fetch('/api/ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'moonshot-v1-32k',
      messages,
      temperature: 0.7,
      stream: true,
    }),
    signal,
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`API 错误: ${err}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const text = decoder.decode(value)
    const lines = text.split('\n')
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const payload = line.slice(6).trim()
        if (payload === '[DONE]') return
        try {
          const parsed = JSON.parse(payload)
          const content = parsed.choices?.[0]?.delta?.content || ''
          if (content) yield content
        } catch {}
      }
    }
  }
}

export async function analyzeScreenshot(
  base64: string,
  mimeType: string
): Promise<string> {
  const apiKey = await getApiKey()
  if (!apiKey) throw new Error('请先在设置中填入 Kimi API Key')

  const response = await fetch('/api/ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'moonshot-v1-32k',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: '请分析这张聊天截图，提取关键信息：\n1. 对话摘要\n2. 对方态度（积极/中性/消极）\n3. 值得记录的关键信息\n\n用简洁中文返回。' },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
        ],
      }],
      temperature: 0.3,
    }),
  })

  const data = await response.json()
  return data.choices?.[0]?.message?.content || '识别失败'
}
