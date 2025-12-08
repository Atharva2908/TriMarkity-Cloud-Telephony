"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Download, Trash2, Play, Pause, RefreshCw, Loader2, Volume2, Calendar, Clock, HardDrive } from "lucide-react"
import { useApiConfig } from "@/hooks/use-api-config"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"

interface Recording {
  call_id: string
  duration: number
  url: string
  size: number
  created_at: string
  to_number: string
  from_number: string
  status?: string
}

interface RecordingManagerProps {
  demoMode?: boolean
}

export function RecordingManager({ demoMode = false }: RecordingManagerProps) {
  const { apiUrl } = useApiConfig()
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(false)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [totalSize, setTotalSize] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    fetchRecordings()
  }, [])

  useEffect(() => {
    const total = recordings.reduce((sum, rec) => sum + rec.size, 0)
    setTotalSize(total)
  }, [recordings])

  const fetchRecordings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (demoMode) {
        setRecordings([
          {
            call_id: "demo-001",
            duration: 145,
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
            size: 2048000,
            created_at: new Date(Date.now() - 86400000).toISOString(),
            to_number: "+12125551001",
            from_number: "+12125551234",
            status: "completed",
          },
          {
            call_id: "demo-002",
            duration: 230,
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
            size: 3276800,
            created_at: new Date(Date.now() - 172800000).toISOString(),
            to_number: "+12125551002",
            from_number: "+12125551234",
            status: "completed",
          },
        ])
      } else {
        const response = await fetch(`${apiUrl}/api/calls/recordings/list`)
        if (!response.ok) throw new Error("Failed to fetch recordings")
        const data = await response.json()
        setRecordings(data.recordings || [])
      }
    } catch (err) {
      console.error("Error fetching recordings:", err)
      setError(err instanceof Error ? err.message : "Failed to load recordings")
    } finally {
      setLoading(false)
    }
  }, [apiUrl, demoMode])

  const handleDelete = useCallback(
    async (callId: string) => {
      if (!confirm("Are you sure you want to delete this recording?")) return

      try {
        if (!demoMode) {
          const response = await fetch(`${apiUrl}/api/calls/recordings/${callId}/delete`, {
            method: "DELETE",
          })
          if (!response.ok) throw new Error("Failed to delete recording")
        }

        if (playingId === callId && audioRef.current) {
          audioRef.current.pause()
          audioRef.current.currentTime = 0
          setPlayingId(null)
        }

        setRecordings((prev) => prev.filter((rec) => rec.call_id !== callId))
      } catch (err) {
        console.error("Error deleting recording:", err)
        setError("Failed to delete recording")
      }
    },
    [apiUrl, demoMode, playingId]
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
        link.download = `recording-${recording.call_id}-${recording.to_number}.mp3`
        link.click()
        window.URL.revokeObjectURL(url)
      } catch (err) {
        console.error("Error downloading recording:", err)
        setError("Failed to download recording")
      }
    },
    [demoMode]
  )

  const handleTogglePlay = useCallback(
    async (recording: Recording) => {
      if (!audioRef.current) {
        audioRef.current = new Audio()
        audioRef.current.addEventListener("ended", () => {
          setPlayingId(null)
          setCurrentTime(0)
        })
        audioRef.current.addEventListener("timeupdate", () => {
          setCurrentTime(audioRef.current?.currentTime || 0)
        })
        audioRef.current.addEventListener("loadedmetadata", () => {
          setDuration(audioRef.current?.duration || 0)
        })
      }

      const audio = audioRef.current

      if (playingId === recording.call_id) {
        audio.pause()
        setPlayingId(null)
        return
      }

      try {
        audio.pause()
        audio.currentTime = 0
        audio.src = recording.url
        await audio.play()
        setPlayingId(recording.call_id)
      } catch (err) {
        console.error("Error playing recording:", err)
        setError("Failed to play recording")
      }
    },
    [playingId]
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
    const secs = Math.floor(seconds % 60)
    return `${mins}:${String(secs).padStart(2, "0")}`
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const filteredRecordings = recordings.filter(
    (rec) =>
      rec.to_number.includes(searchTerm) ||
      rec.from_number.includes(searchTerm) ||
      rec.call_id.includes(searchTerm)
  )

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
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-6 bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Recording Manager</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage and playback call recordings
            </p>
          </div>
          <Button onClick={fetchRecordings} disabled={loading} variant="outline" size="sm" className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </Card>

      {/* Demo Mode Banner */}
      {demoMode && (
        <Card className="p-3 bg-blue-500/10 border-blue-500/20">
          <p className="text-sm text-blue-600 dark:text-blue-400">
            📌 Demo Mode: Using sample recordings for demonstration
          </p>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <div className="flex items-center gap-3">
            <Volume2 className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Recordings</p>
              <p className="text-3xl font-bold text-foreground">{recordings.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <div className="flex items-center gap-3">
            <HardDrive className="w-8 h-8 text-green-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Storage</p>
              <p className="text-3xl font-bold text-foreground">{formatBytes(totalSize)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-purple-500" />
            <div>
              <p className="text-sm text-muted-foreground">Total Duration</p>
              <p className="text-3xl font-bold text-foreground">
                {formatDuration(recordings.reduce((sum, rec) => sum + rec.duration, 0))}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <Card className="p-4">
        <Input
          placeholder="Search by phone number or call ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full"
        />
      </Card>

      {/* Error Display */}
      {error && (
        <Card className="p-4 bg-destructive/10 border-destructive/20">
          <p className="text-destructive text-sm">{error}</p>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card className="p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Loading recordings...</p>
        </Card>
      )}

      {/* Recordings List */}
      {!loading && (
        <div className="space-y-2">
          {filteredRecordings.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              {searchTerm ? "No recordings found matching your search" : "No recordings yet"}
            </Card>
          ) : (
            filteredRecordings.map((recording) => (
              <Card
                key={recording.call_id}
                className={`p-4 ${
                  playingId === recording.call_id
                    ? "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20"
                    : ""
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  {/* Recording Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold font-mono text-foreground">{recording.to_number}</p>
                      {playingId === recording.call_id && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                          Playing
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(recording.created_at)}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(recording.duration)}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3" />
                        {formatBytes(recording.size)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      From: <span className="font-mono">{recording.from_number}</span>
                    </p>

                    {/* Progress Bar */}
                    {playingId === recording.call_id && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>{formatDuration(currentTime)}</span>
                          <span>{formatDuration(duration)}</span>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full transition-all"
                            style={{ width: `${(currentTime / duration) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleTogglePlay(recording)}
                      size="sm"
                      variant={playingId === recording.call_id ? "default" : "secondary"}
                      className="gap-2"
                      title={playingId === recording.call_id ? "Pause" : "Play"}
                    >
                      {playingId === recording.call_id ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </Button>

                    <Button
                      onClick={() => handleDownload(recording)}
                      size="sm"
                      variant="secondary"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </Button>

                    <Button
                      onClick={() => handleDelete(recording.call_id)}
                      size="sm"
                      variant="destructive"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Results Count */}
      {!loading && filteredRecordings.length > 0 && (
        <Card className="p-3 bg-secondary/20">
          <p className="text-sm text-center text-muted-foreground">
            Showing {filteredRecordings.length} of {recordings.length} recordings
          </p>
        </Card>
      )}
    </div>
  )
}
