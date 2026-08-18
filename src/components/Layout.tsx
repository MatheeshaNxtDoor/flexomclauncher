import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TitleBar from './TitleBar'

export default function Layout() {
  return (
    <div className="flex flex-col h-screen bg-surface-950">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
