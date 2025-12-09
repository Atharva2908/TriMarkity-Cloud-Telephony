"use client"

import { RecordingManager } from "@/components/recording-manager"

export default function RecordingsPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Call Recordings</h1>
          <p className="text-muted-foreground">
            Listen to, download, and manage your call recordings
          </p>
        </div>

        <RecordingManager demoMode={false} />
      </div>
    </main>
  )
}
