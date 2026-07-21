import { useState, useEffect, useRef } from 'react'
import { db } from '../services/db'
import { streamChat, ChatMessage } from '../services/ai'

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    db.getChatHistory().then(setMessages)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    const text = input.trim()
    if (!text || streaming) return

    setInput('')
    const userMsg = await db.addChatMessage('user', text)
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)

    await generateResponse(updatedMessages)
  }

  async function generateResponse(currentMessages: Message[]) {
    setStreaming(true)
    const controller = new AbortController()
    abortRef.current = controller

    const apiMessages: ChatMessage[] = currentMessages.map(m => ({
      role: m.role,
      content: m.content,
    }))

    const assistantId = Date.now() + 1
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])

    let fullText = ''
    try {
      for await (const chunk of streamChat(apiMessages, controller.signal)) {
        fullText += chunk
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: fullText } : m)
        )
      }
      if (fullText) {
        await db.addChatMessage('assistant', fullText)
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        const errText = `出错了: ${err.message}`
        setMessages(prev =>
          prev.map(m => m.id === assistantId ? { ...m, content: errText } : m)
        )
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || streaming) return

    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]
      const mimeType = file.type || 'image/jpeg'

      const userMsg = await db.addChatMessage('user', '[图片] 请分析这张图片')
      const updatedMessages = [...messages, userMsg]
      setMessages(updatedMessages)

      setStreaming(true)
      const controller = new AbortController()
      abortRef.current = controller

      const apiMessages: ChatMessage[] = [
        ...updatedMessages.slice(0, -1).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
        {
          role: 'user' as const,
          content: [
            { type: 'text', text: '请分析这张图片' },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
          ],
        },
      ]

      const assistantId = Date.now() + 1
      setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }])

      let fullText = ''
      try {
        for await (const chunk of streamChat(apiMessages, controller.signal)) {
          fullText += chunk
          setMessages(prev =>
            prev.map(m => m.id === assistantId ? { ...m, content: fullText } : m)
          )
        }
        if (fullText) await db.addChatMessage('assistant', fullText)
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          const errMsg = `出错了: ${err.message}`
          setMessages(prev =>
            prev.map(m => m.id === assistantId ? { ...m, content: errMsg } : m)
          )
        }
      } finally {
        setStreaming(false)
        abortRef.current = null
      }
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div className="flex flex-col h-full pb-16 md:pb-0">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <span className="text-4xl mb-4">💕</span>
            <p className="text-lg font-medium text-gray-500">Su</p>
            <p className="text-sm mt-1">说说你的困惑...</p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl whitespace-pre-wrap text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-primary text-white rounded-br-md'
                : 'bg-white text-gray-700 rounded-bl-md shadow-sm'
            }`}>
              {msg.content || '...'}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-pink-100 bg-white p-3 flex items-end gap-2">
        <label className="cursor-pointer text-gray-400 hover:text-primary p-2">
          <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          📷
        </label>
        <textarea
          className="flex-1 resize-none border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary max-h-28"
          rows={1}
          placeholder="说说你的困惑..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
        />
        <button
          onClick={handleSend}
          disabled={streaming || !input.trim()}
          className="bg-primary text-white rounded-full w-9 h-9 flex items-center justify-center disabled:opacity-40 hover:bg-primary-dark transition-colors"
        >
          ▶
        </button>
      </div>
    </div>
  )
}
