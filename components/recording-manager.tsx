"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Download, Trash2, Play, Pause } from "lucide-react"

interface Recording {
  call_id: string
  duration: number
  url: string
  size: number
  created_at: string
  to_number: string
  from_number: string
}

interface RecordingManagerProps {
  apiUrl: string
  demoMode: boolean
}

export function RecordingManager({ apiUrl, demoMode }: RecordingManagerProps) {
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(false)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [totalSize, setTotalSize] = useState(0)

  // Single audio element reused for all recordings
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    fetchRecordings()
  }, [])

  const fetchRecordings = useCallback(async () => {
    setLoading(true)
    try {
      if (demoMode) {
        setRecordings([
          {
            call_id: "demo-001",
            duration: 145,
            url: "demo-recording-1.mp3",
            size: 2048000,
            created_at: new Date(Date.now() - 86400000).toISOString(),
            to_number: "+12125551001",
            from_number: "+12125551234",
          },
          {
            call_id: "demo-002",
            duration: 230,
            url: "demo-recording-2.mp3",
            size: 3276800,
            created_at: new Date(Date.now() - 172800000).toISOString(),
            to_number: "+12125551002",
            from_number: "+12125551234",
          },
        ])
      } else {
        const response = await fetch(`${apiUrl}/api/calls/recordings/list`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        })

        if (!response.ok) throw new Error("Failed to fetch recordings")

        const data = await response.json()
        setRecordings(data.recordings || [])
      }
    } catch (error) {
      console.error("Error fetching recordings:", error)
    } finally {
      setLoading(false)
    }
  }, [apiUrl, demoMode])

  useEffect(() => {
    const total = recordings.reduce((sum, rec) => sum + rec.size, 0)
    setTotalSize(total)
  }, [recordings])

  const handleDelete = useCallback(
    async (callId: string) => {
      try {
        if (!demoMode) {
          const response = await fetch(
            `${apiUrl}/api/calls/recordings/${callId}/delete`,
            {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
            },
          )

          if (!response.ok) throw new Error("Failed to delete recording")
        }

        // If currently playing this recording, stop playback
        if (playingId === callId && audioRef.current) {
          audioRef.current.pause()
          audioRef.current.currentTime = 0
        }
        setPlayingId(prev => (prev === callId ? null : prev))

        setRecordings(prev => prev.filter(rec => rec.call_id !== callId))
      } catch (error) {
        console.error("Error deleting recording:", error)
      }
    },
    [apiUrl, demoMode, playingId],
  )

  const handleDownload = useCallback(
    async (recording: Recording) => {
      if (demoMode) {
        alert("Recording download not available in demo mode")
        return
      }

      try {
        const response = await fetch(recording.url)
        if (!response.ok) throw new Error("Download failed")
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `recording-${recording.call_id}.mp3`
        link.click()
        window.URL.revokeObjectURL(url)
      } catch (error) {
        console.error("Error downloading recording:", error)
      }
    },
    [demoMode],
  )

  // Play / pause using a shared <audio> element
  const handleTogglePlay = useCallback(
    async (recording: Recording) => {
      if (!audioRef.current) {
        audioRef.current = new Audio()
        // When playback ends, clear playingId
        audioRef.current.addEventListener("ended", () => {
          setPlayingId(null)
        })
      }
      const audio = audioRef.current

      // If clicking the one that's already playing -> pause/stop
      if (playingId === recording.call_id) {
        audio.pause()
        audio.currentTime = 0
        setPlayingId(null)
        return
      }

      try {
        // Switch source and play
        audio.pause()
        audio.currentTime = 0
        audio.src = recording.url
        await audio.play()
        setPlayingId(recording.call_id)
      } catch (error) {
        console.error("Error playing recording:", error)
      }
    },
    [playingId],
  )

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${String(secs).padStart(2, "0")}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  // Cleanup audio element on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ""
        audioRef.current = null
      }
    }
  }, [])

  return (
    <div className="bg-card rounded-lg border border-border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Recording Manager</h2>
        <button
          onClick={fetchRecordings}
          disabled={loading}
          className="px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-sm disabled:opacity-50 transition-colors"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {demoMode && (
        <div className="text-xs bg-ring/10 border border-ring rounded p-2 text-ring">
          Demo Mode: Limited functionality
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 text-sm">
        <div className="bg-input rounded p-3">
          <p className="text-muted-foreground">Total Recordings</p>
          <p className="text-2xl font-bold">{recordings.length}</p>
        </div>
        <div className="bg-input rounded p-3">
          <p className="text-muted-foreground">Total Storage</p>
          <p className="text-2xl font-bold">{formatBytes(totalSize)}</p>
        </div>
        <div className="bg-input rounded p-3">
          <p className="text-muted-foreground">Total Duration</p>
          <p className="text-2xl font-bold">
            {formatDuration(
              recordings.reduce((sum, rec) => sum + rec.duration, 0),
            )}
          </p>
        </div>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {recordings.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            No recordings yet
          </p>
        ) : (
          recordings.map(recording => (
            <div
              key={recording.call_id}
              className="bg-input rounded-lg p-3 flex items-center justify-between gap-3"
            >
              <div className="flex-1">
                <div className="font-medium text-sm">{recording.to_number}</div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(recording.created_at)} •{" "}
                  {formatDuration(recording.duration)} •{" "}
                  {formatBytes(recording.size)}
                </div>
              </div>

              <div className="flex gap-1">
                <button
                  onClick={() => handleTogglePlay(recording)}
                  className="p-2 rounded bg-secondary hover:bg-secondary/80 transition-colors"
                  title="Play recording"
                >
                  {playingId === recording.call_id ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </button>

                <button
                  onClick={() => handleDownload(recording)}
                  className="p-2 rounded bg-secondary hover:bg-secondary/80 transition-colors"
                  title="Download recording"
                >
                  <Download className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleDelete(recording.call_id)}
                  className="p-2 rounded bg-destructive/20 hover:bg-destructive/30 transition-colors"
                  title="Delete recording"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
