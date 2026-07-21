import { openDB, DBSchema } from 'idb'

interface SuDB extends DBSchema {
  chatHistory: {
    key: number
    value: { id: number; role: 'user' | 'assistant'; content: string; timestamp: number }
  }
  knowledge: {
    key: number
    value: { id: number; category: string; content: string; createdAt: string }
    indexes: { 'by-category': string }
  }
  profile: {
    key: string
    value: { key: string; value: string }
  }
  settings: {
    key: string
    value: { key: string; value: string }
  }
}

const DB_NAME = 'su-app'
const DB_VERSION = 1

function getDB() {
  return openDB<SuDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('chatHistory')) {
        db.createObjectStore('chatHistory', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('knowledge')) {
        const store = db.createObjectStore('knowledge', { keyPath: 'id' })
        store.createIndex('by-category', 'category')
      }
      if (!db.objectStoreNames.contains('profile')) {
        db.createObjectStore('profile', { keyPath: 'key' })
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' })
      }
    },
  })
}

export const db = {
  async getChatHistory() {
    const d = await getDB()
    const all = await d.getAll('chatHistory')
    return all.sort((a, b) => a.id - b.id)
  },

  async addChatMessage(role: 'user' | 'assistant', content: string) {
    const d = await getDB()
    const msg = { id: Date.now(), role, content, timestamp: Date.now() }
    await d.add('chatHistory', msg)
    return msg
  },

  async clearChat() {
    const d = await getDB()
    await d.clear('chatHistory')
  },

  async truncateChatAfter(id: number) {
    const d = await getDB()
    const all = await d.getAll('chatHistory')
    const toDelete = all.filter(m => m.id >= id)
    const tx = d.transaction('chatHistory', 'readwrite')
    for (const m of toDelete) {
      await tx.store.delete(m.id)
    }
    await tx.done
  },

  async getKnowledge(category?: string) {
    const d = await getDB()
    if (category && category !== 'all') {
      return d.getAllFromIndex('knowledge', 'by-category', category)
    }
    const all = await d.getAll('knowledge')
    return all.sort((a, b) => b.id - a.id)
  },

  async addKnowledge(category: string, content: string) {
    const d = await getDB()
    const entry = { id: Date.now(), category, content, createdAt: new Date().toISOString() }
    await d.add('knowledge', entry)
    return entry
  },

  async deleteKnowledge(id: number) {
    const d = await getDB()
    await d.delete('knowledge', id)
  },

  async getProfile() {
    const d = await getDB()
    const all = await d.getAll('profile')
    const obj: Record<string, string> = {}
    for (const item of all) obj[item.key] = item.value
    return obj
  },

  async saveProfile(data: Record<string, string>) {
    const d = await getDB()
    const tx = d.transaction('profile', 'readwrite')
    for (const [key, value] of Object.entries(data)) {
      await tx.store.put({ key, value })
    }
    await tx.done
  },

  async getSetting(key: string) {
    const d = await getDB()
    const item = await d.get('settings', key)
    return item?.value || ''
  },

  async setSetting(key: string, value: string) {
    const d = await getDB()
    await d.put('settings', { key, value })
  },
}
