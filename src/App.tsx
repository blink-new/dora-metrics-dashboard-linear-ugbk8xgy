import React, { useState } from 'react'
import DORADashboard from './components/DORADashboard'
import ErrorBoundary from './components/ErrorBoundary'
import ReadmePage from './components/ReadmePage'
import { AuthWrapper } from './components/AuthWrapper'
import { Button } from './components/ui/button'
import { BookOpen, BarChart3 } from 'lucide-react'
import './App.css'

function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'readme'>('dashboard')

  return (
    <ErrorBoundary>
      <AuthWrapper>
        <div className="min-h-screen bg-slate-50">
          {/* Navigation Header */}
          <header className="bg-white border-b border-slate-200 px-4 py-3">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-slate-900">DORA Metrics Dashboard</h1>
              </div>
              
              <nav className="flex items-center gap-2">
                <Button
                  variant={currentView === 'dashboard' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setCurrentView('dashboard')}
                  className="flex items-center gap-2"
                >
                  <BarChart3 className="w-4 h-4" />
                  Dashboard
                </Button>
                <Button
                  variant={currentView === 'readme' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setCurrentView('readme')}
                  className="flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4" />
                  Documentation
                </Button>
              </nav>
            </div>
          </header>

          {/* Main Content */}
          <main>
            {currentView === 'dashboard' ? <DORADashboard /> : <ReadmePage />}
          </main>
        </div>
      </AuthWrapper>
    </ErrorBoundary>
  )
}

export default App