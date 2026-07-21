import { NavLink, Outlet } from 'react-router-dom'

const navItems = [
  { to: '/', label: '对话', icon: '💬' },
  { to: '/knowledge', label: '知识库', icon: '📚' },
  { to: '/profile', label: 'TA的档案', icon: '💕' },
  { to: '/settings', label: '设置', icon: '⚙️' },
]

export default function Layout() {
  return (
    <div className="flex h-screen bg-warm">
      {/* Sidebar - desktop */}
      <aside className="hidden md:flex flex-col w-56 bg-white border-r border-pink-100 p-4">
        <div className="flex items-center gap-2 mb-8">
          <span className="text-2xl">💕</span>
          <h1 className="text-xl font-bold text-primary">Su</h1>
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  isActive ? 'bg-primary-light text-primary font-medium' : 'text-gray-600 hover:bg-gray-50'
                }`
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <Outlet />
      </main>

      {/* Bottom nav - mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-pink-100 flex justify-around py-2 z-50">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1 text-xs ${
                isActive ? 'text-primary' : 'text-gray-400'
              }`
            }
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
