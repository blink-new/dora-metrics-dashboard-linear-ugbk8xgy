import React, { useState, useEffect } from 'react'
import { blink } from '../blink/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Shield, Lock, BarChart3 } from 'lucide-react'

interface AuthWrapperProps {
  children: React.ReactNode
}

interface User {
  id: string
  email: string
  displayName?: string
}

export function AuthWrapper({ children }: AuthWrapperProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
      setLoading(state.isLoading)
    })
    return unsubscribe
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
              <BarChart3 className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-slate-900">
                DORA Metrics Dashboard
              </CardTitle>
              <CardDescription className="text-slate-600 mt-2">
                Secure access to your team's performance metrics
              </CardDescription>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Shield className="w-4 h-4 text-green-600" />
                <span>Protected data access</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Lock className="w-4 h-4 text-green-600" />
                <span>Secure Linear API integration</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <BarChart3 className="w-4 h-4 text-green-600" />
                <span>Personal metrics dashboard</span>
              </div>
            </div>
            
            <Button 
              onClick={() => blink.auth.login()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3"
              size="lg"
            >
              Sign In to Access Dashboard
            </Button>
            
            <p className="text-xs text-slate-500 text-center">
              Your data is encrypted and only accessible to you
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      {/* User info header */}
      <div className="bg-white border-b border-slate-200 px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-blue-600">
                {user.displayName?.[0] || user.email[0].toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">
                {user.displayName || user.email}
              </p>
              <p className="text-xs text-slate-500">DORA Metrics Dashboard</p>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => blink.auth.logout()}
            className="text-slate-600 hover:text-slate-900"
          >
            Sign Out
          </Button>
        </div>
      </div>
      
      {/* Protected content */}
      {children}
    </div>
  )
}