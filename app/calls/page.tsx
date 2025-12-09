"use client"

import { OutboundCalling } from "@/components/outbound-calling"
import { RecordingManager } from "@/components/recording-manager"
import { Navigation } from "@/components/navigation"
import { useState, useEffect } from "react"
import { useApiConfig } from "@/hooks/use-api-config"
import { Phone, Mic, AlertCircle } from "lucide-react"

export default function CallsPage() {
  const { apiUrl } = useApiConfig()
  const [useDemo, setUseDemo] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [apiStatus, setApiStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking')

  // Check API connectivity on mount
  useEffect(() => {
    const checkApiConnection = async () => {
      try {
        setIsChecking(true)
        
        // Try to ping the API health endpoint
        const response = await fetch(`${apiUrl}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(3000), // 3 second timeout
        })

        if (response.ok) {
          setApiStatus('connected')
          setUseDemo(false)
        } else {
          setApiStatus('disconnected')
          setUseDemo(true)
        }
      } catch (error) {
        console.log("API connection check failed:", error)
        setApiStatus('disconnected')
        setUseDemo(true)
      } finally {
        setIsChecking(false)
      }
    }

    checkApiConnection()
  }, [apiUrl])

  const handleRetryConnection = () => {
    setIsChecking(true)
    setApiStatus('checking')
    
    setTimeout(() => {
      fetch(`${apiUrl}/health`)
        .then(res => {
          if (res.ok) {
            setApiStatus('connected')
            setUseDemo(false)
          } else {
            setApiStatus('disconnected')
            setUseDemo(true)
          }
        })
        .catch(() => {
          setApiStatus('disconnected')
          setUseDemo(true)
        })
        .finally(() => setIsChecking(false))
    }, 500)
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Phone className="w-8 h-8 text-primary" />
                Call Management
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage outbound calls and recordings
              </p>
            </div>
            
            {/* API Status Indicator */}
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${
                apiStatus === 'connected' 
                  ? 'bg-green-500/10 border-green-500/20 text-green-500'
                  : apiStatus === 'disconnected'
                  ? 'bg-red-500/10 border-red-500/20 text-red-500'
                  : 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500'
              }`}>
                <div className={`w-2 h-2 rounded-full ${
                  apiStatus === 'connected' 
                    ? 'bg-green-500 animate-pulse' 
                    : apiStatus === 'disconnected'
                    ? 'bg-red-500'
                    : 'bg-yellow-500 animate-pulse'
                }`} />
                <span className="text-xs font-medium">
                  {apiStatus === 'connected' && 'API Connected'}
                  {apiStatus === 'disconnected' && 'API Offline'}
                  {apiStatus === 'checking' && 'Checking...'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Demo Mode Banner */}
        {useDemo && !isChecking && (
          <div className="mb-6 p-4 bg-ring/10 border border-ring rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-ring mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-ring">Demo Mode Active</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Backend API not connected. You can still explore the interface, but calls won't be processed.
                </p>
                <p className="text-muted-foreground text-sm mt-1">
                  API URL: <code className="px-1.5 py-0.5 bg-muted rounded text-xs">{apiUrl}</code>
                </p>
                <button
                  onClick={handleRetryConnection}
                  disabled={isChecking}
                  className="mt-3 px-3 py-1.5 bg-ring text-ring-foreground rounded text-sm hover:bg-ring/90 transition-colors disabled:opacity-50"
                >
                  {isChecking ? 'Retrying...' : 'Retry Connection'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Success Banner */}
        {apiStatus === 'connected' && !isChecking && (
          <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-green-500">Backend Connected</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Ready to make calls and manage recordings.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Outbound Calling Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Phone className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Outbound Calling</h2>
            </div>
            <OutboundCalling apiUrl={apiUrl} demoMode={useDemo} />
          </div>

          {/* Recording Manager Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Mic className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Recording Manager</h2>
            </div>
            <RecordingManager apiUrl={apiUrl} demoMode={useDemo} />
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 p-4 bg-muted/50 border border-border rounded-lg">
          <h3 className="font-semibold text-sm mb-2">Quick Tips</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• All calls are automatically recorded when connected</li>
            <li>• Recordings are available immediately after call ends</li>
            <li>• Use the Recording Manager to download or manage your call recordings</li>
            <li>• Check call logs and analytics for detailed insights</li>
          </ul>
        </div>
      </div>
    </main>
  )
}
