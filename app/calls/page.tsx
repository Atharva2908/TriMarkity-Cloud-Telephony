"use client"

import { OutboundCalling } from "@/components/outbound-calling"
import { RecordingManager } from "@/components/recording-manager"
import { Navigation } from "@/components/navigation"
import { useState } from "react"

export default function CallsPage() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
  const [useDemo, setUseDemo] = useState(true)

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Call Management</h1>
          <p className="text-muted-foreground mt-1">Manage outbound calls and recordings</p>
        </div>

        {useDemo && (
          <div className="mb-6 p-4 bg-ring/10 border border-ring rounded-lg text-sm">
            <p className="font-medium text-ring">Demo Mode Active</p>
            <p className="text-muted-foreground mt-1">Backend API not connected.</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <OutboundCalling apiUrl={apiUrl} demoMode={useDemo} />
          <RecordingManager apiUrl={apiUrl} demoMode={useDemo} />
        </div>
      </div>
    </main>
  )
}
