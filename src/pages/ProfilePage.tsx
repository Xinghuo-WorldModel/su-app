import { useState, useEffect } from 'react'
import { db } from '../services/db'

export default function ProfilePage() {
  const [profile, setProfile] = useState({
    name: '', age: '', occupation: '', hobbies: '', personality: '', notes: ''
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    db.getProfile().then(data => {
      setProfile(prev => ({ ...prev, ...data }))
    })
  }, [])

  async function handleSave() {
    await db.saveProfile(profile)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const fields = [
    { key: 'name', label: '名字 / 昵称', placeholder: 'TA的名字' },
    { key: 'age', label: '年龄', placeholder: '年龄' },
    { key: 'occupation', label: '职业', placeholder: '职业信息' },
    { key: 'hobbies', label: '兴趣爱好', placeholder: '爱好、喜欢的事' },
    { key: 'personality', label: '性格特点', placeholder: '性格、MBTI等' },
  ]

  return (
    <div className="flex flex-col h-full pb-16 md:pb-0 overflow-y-auto">
      <div className="p-4 max-w-lg mx-auto w-full">
        <h2 className="text-lg font-bold text-gray-800 mb-6">TA的档案</h2>

        <div className="space-y-4">
          {fields.map(f => (
            <div key={f.key}>
              <label className="text-sm text-gray-500 mb-1 block">{f.label}</label>
              <input
                type="text"
                value={(profile as any)[f.key]}
                onChange={e => setProfile(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary"
              />
            </div>
          ))}

          <div>
            <label className="text-sm text-gray-500 mb-1 block">其他备注</label>
            <textarea
              value={profile.notes}
              onChange={e => setProfile(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="任何你想记录的信息"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary resize-none"
            />
          </div>

          <button
            onClick={handleSave}
            className="w-full py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors"
          >
            {saved ? '✓ 已保存' : '保存档案'}
          </button>
        </div>
      </div>
    </div>
  )
}
