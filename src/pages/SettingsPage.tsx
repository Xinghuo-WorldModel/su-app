import { useState, useEffect } from 'react'
import { db } from '../services/db'

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    db.getSetting('apiKey').then(v => setApiKey(v || ''))
  }, [])

  async function handleSave() {
    await db.setSetting('apiKey', apiKey)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleClearChat() {
    if (confirm('确定清空所有聊天记录吗？')) {
      await db.clearChat()
      alert('已清空')
    }
  }

  return (
    <div className="flex flex-col h-full pb-16 md:pb-0 overflow-y-auto">
      <div className="p-4 max-w-lg mx-auto w-full">
        <h2 className="text-lg font-bold text-gray-800 mb-6">设置</h2>

        <div className="space-y-6">
          {/* API Key */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <label className="text-sm font-medium text-gray-700 mb-2 block">Kimi API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary mb-3"
            />
            <p className="text-xs text-gray-400 mb-3">
              获取方式：<a href="https://platform.moonshot.cn" target="_blank" className="text-primary underline">platform.moonshot.cn</a>
            </p>
            <button
              onClick={handleSave}
              className="w-full py-2 bg-primary text-white rounded-xl text-sm hover:bg-primary-dark"
            >
              {saved ? '✓ 已保存' : '保存 Key'}
            </button>
          </div>

          {/* Clear chat */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-medium text-gray-700 mb-2">数据管理</h3>
            <button
              onClick={handleClearChat}
              className="w-full py-2 border border-red-200 text-red-500 rounded-xl text-sm hover:bg-red-50"
            >
              清空聊天记录
            </button>
          </div>

          {/* About */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-medium text-gray-700 mb-2">关于</h3>
            <p className="text-xs text-gray-400">
              Su - AI恋爱顾问 v1.0<br />
              数据存储在本地浏览器中，不会上传到任何服务器。<br />
              苹果、安卓、电脑均可使用。
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
