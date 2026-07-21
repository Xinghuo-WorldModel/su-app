import { useState, useEffect } from 'react'
import { db } from '../services/db'
import { analyzeScreenshot } from '../services/ai'

interface KnowledgeEntry {
  id: number
  category: string
  content: string
  createdAt: string
}

const categories = [
  { id: 'all', label: '全部' },
  { id: 'profile', label: '基础信息' },
  { id: 'event', label: '事件' },
  { id: 'chat', label: '聊天' },
  { id: 'preference', label: '偏好/雷区' },
]

export default function KnowledgePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [filter, setFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [newCategory, setNewCategory] = useState('profile')
  const [newContent, setNewContent] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadEntries() }, [filter])

  async function loadEntries() {
    const data = await db.getKnowledge(filter)
    setEntries(data)
  }

  async function handleAdd() {
    if (!newContent.trim()) return
    await db.addKnowledge(newCategory, newContent.trim())
    setNewContent('')
    setShowAdd(false)
    loadEntries()
  }

  async function handleDelete(id: number) {
    await db.deleteKnowledge(id)
    loadEntries()
  }

  async function handleScreenshot(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)

    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1]
        const result = await analyzeScreenshot(base64, file.type)
        await db.addKnowledge('chat', result)
        loadEntries()
        setLoading(false)
      }
      reader.readAsDataURL(file)
    } catch {
      setLoading(false)
    }
    e.target.value = ''
  }

  return (
    <div className="flex flex-col h-full pb-16 md:pb-0">
      {/* Header */}
      <div className="p-4 bg-white border-b border-pink-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-800">知识库</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAdd(true)}
              className="px-4 py-2 bg-primary text-white text-sm rounded-full hover:bg-primary-dark"
            >
              + 文字录入
            </button>
            <label className="px-4 py-2 bg-white border border-primary text-primary text-sm rounded-full cursor-pointer hover:bg-primary-light">
              📷 截图识别
              <input type="file" accept="image/*" className="hidden" onChange={handleScreenshot} />
            </label>
          </div>
        </div>
        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setFilter(cat.id)}
              className={`px-3 py-1 rounded-full text-sm whitespace-nowrap ${
                filter === cat.id ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && (
          <div className="text-center text-gray-400 py-8">正在识别截图...</div>
        )}
        {entries.length === 0 && !loading && (
          <div className="text-center text-gray-400 py-8">暂无记录，点击上方按钮添加</div>
        )}
        {entries.map(entry => (
          <div key={entry.id} className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary-light text-primary">
                {categories.find(c => c.id === entry.category)?.label || entry.category}
              </span>
              <button
                onClick={() => handleDelete(entry.id)}
                className="text-gray-300 hover:text-red-400 text-sm"
              >✕</button>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{entry.content}</p>
            <p className="text-xs text-gray-300 mt-2">{new Date(entry.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-800 mb-4">添加知识</h3>
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 mb-3 text-sm focus:outline-none focus:border-primary"
            >
              {categories.filter(c => c.id !== 'all').map(cat => (
                <option key={cat.id} value={cat.id}>{cat.label}</option>
              ))}
            </select>
            <textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="输入内容..."
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => setShowAdd(false)}
                className="flex-1 py-2 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50"
              >取消</button>
              <button
                onClick={handleAdd}
                className="flex-1 py-2 bg-primary text-white rounded-xl hover:bg-primary-dark"
              >保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
