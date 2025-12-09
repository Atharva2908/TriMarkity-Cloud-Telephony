"use client"

import { useState, useCallback, useEffect, useRef } from "react"
import { Download, Trash2, Play, Pause, RefreshCw, Loader2, Volume2, Calendar, Clock, HardDrive, AlertCircle } from "lucide-react"
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
  _id?: string
  recording_id?: string
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
  const [audioError, setAudioError] = useState<string | null>(null)
  const [wsConnected, setWsConnected] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<WebSocket | null>(null)

  // ✅ WebSocket for real-time updates
  useEffect(() => {
    if (demoMode) return

    const connectWebSocket = () => {
      const wsUrl = apiUrl.replace('http://', 'ws://').replace('https://', 'wss://')
      const ws = new WebSocket(`${wsUrl}/ws/calls`)

      ws.onopen = () => {
        console.log('📡 WebSocket connected for recordings')
        setWsConnected(true)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          // Handle recording added
          if (data.type === 'recording_added') {
            console.log('🎙️ New recording added:', data.call_id)
            fetchRecordings() // Refresh list
          }
          
          // Handle recording deleted
          if (data.type === 'recording_deleted') {
            console.log('🗑️ Recording deleted:', data.call_id)
            setRecordings(prev => prev.filter(rec => rec.call_id !== data.call_id))
            
            // Stop playback if deleted recording is playing
            if (playingId === data.call_id && audioRef.current) {
              audioRef.current.pause()
              setPlayingId(null)
            }
          }
        } catch (err) {
          console.error('WebSocket message error:', err)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setWsConnected(false)
      }

      ws.onclose = () => {
        console.log('📡 WebSocket disconnected')
        setWsConnected(false)
        
        // Reconnect after 3 seconds
        setTimeout(() => {
          console.log('🔄 Attempting to reconnect WebSocket...')
          connectWebSocket()
        }, 3000)
      }

      wsRef.current = ws
    }

    connectWebSocket()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [apiUrl, demoMode, playingId])

  // Calculate total size
  useEffect(() => {
    const total = recordings.reduce((sum, rec) => sum + (rec.size || 0), 0)
    setTotalSize(total)
  }, [recordings])

  // Fetch recordings on mount
  useEffect(() => {
    fetchRecordings()
  }, [])

  // Initialize audio element with proper event listeners
  useEffect(() => {
    if (!audioRef.current) {
      const audio = new Audio()
      
      const handleEnded = () => {
        setPlayingId(null)
        setCurrentTime(0)
      }

      const handleTimeUpdate = () => {
        setCurrentTime(audio.currentTime)
      }

      const handleLoadedMetadata = () => {
        setDuration(audio.duration)
      }

      const handleError = (e: Event) => {
        console.error("Audio playback error:", e)
        setAudioError("Failed to load audio. The recording may be unavailable.")
        setPlayingId(null)
      }

      const handleLoadStart = () => {
        setAudioError(null)
      }

      audio.addEventListener("ended", handleEnded)
      audio.addEventListener("timeupdate", handleTimeUpdate)
      audio.addEventListener("loadedmetadata", handleLoadedMetadata)
      audio.addEventListener("error", handleError)
      audio.addEventListener("loadstart", handleLoadStart)

      audioRef.current = audio

      return () => {
        audio.removeEventListener("ended", handleEnded)
        audio.removeEventListener("timeupdate", handleTimeUpdate)
        audio.removeEventListener("loadedmetadata", handleLoadedMetadata)
        audio.removeEventListener("error", handleError)
        audio.removeEventListener("loadstart", handleLoadStart)
        audio.pause()
        audio.src = ""
      }
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.src = ""
        audioRef.current = null
      }
    }
  }, [])

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
          {
            call_id: "demo-003",
            duration: 180,
            url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
            size: 2621440,
            created_at: new Date(Date.now() - 259200000).toISOString(),
            to_number: "+12125551003",
            from_number: "+12125551234",
            status: "completed",
          },
        ])
      } else {
        const response = await fetch(`${apiUrl}/api/calls/recordings/list`)
        if (!response.ok) {
          throw new Error(`Failed to fetch recordings: ${response.status}`)
        }
        const data = await response.json()
        
        const recordingsList = Array.isArray(data.recordings) ? data.recordings : []
        const validRecordings = recordingsList.filter(rec => rec.url && rec.url.trim() !== '')
        
        setRecordings(validRecordings)
        
        if (validRecordings.length === 0 && recordingsList.length > 0) {
          console.warn('Some recordings were filtered out due to missing URLs')
        }
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
      if (!confirm("Are you sure you want to delete this recording? This action cannot be undone.")) {
        return
      }

      try {
        if (playingId === callId && audioRef.current) {
          audioRef.current.pause()
          audioRef.current.currentTime = 0
          setPlayingId(null)
        }

        if (!demoMode) {
          const response = await fetch(`${apiUrl}/api/calls/recordings/${encodeURIComponent(callId)}/delete`, {
            method: "DELETE",
          })
          if (!response.ok) {
            throw new Error(`Failed to delete recording: ${response.status}`)
          }
        }

        setRecordings((prev) => prev.filter((rec) => rec.call_id !== callId))
        setError(null)
        setAudioError(null)
      } catch (err) {
        console.error("Error deleting recording:", err)
        setError(err instanceof Error ? err.message : "Failed to delete recording")
      }
    },
    [apiUrl, demoMode, playingId]
  )

  const handleDownload = useCallback(
    async (recording: Recording) => {
      try {
        if (demoMode) {
          window.open(recording.url, '_blank')
          return
        }

        setError(null)
        
        const response = await fetch(recording.url, {
          mode: 'cors',
          credentials: 'omit'
        })
        
        if (!response.ok) throw new Error("Download failed")
        
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        
        const timestamp = new Date(recording.created_at).toISOString().split('T')[0]
        link.download = `recording-${timestamp}-${recording.to_number}.mp3`
        
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        setTimeout(() => window.URL.revokeObjectURL(url), 100)
      } catch (err) {
        console.error("Error downloading recording:", err)
        setError(err instanceof Error ? err.message : "Failed to download recording")
      }
    },
    [demoMode]
  )

  const handleTogglePlay = useCallback(
    async (recording: Recording) => {
      if (!audioRef.current) return

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
        setAudioError(null)
      } catch (err) {
        console.error("Error playing recording:", err)
        setAudioError("Failed to play recording. Please try again.")
        setPlayingId(null)
      }
    },
    [playingId]
  )

  const handleProgressBarClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!audioRef.current || !progressBarRef.current) return

      const rect = progressBarRef.current.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const percentage = Math.max(0, Math.min(1, clickX / rect.width))
      const newTime = percentage * duration

      audioRef.current.currentTime = newTime
      setCurrentTime(newTime)
    },
    [duration]
  )

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i]
  }

  const formatDuration = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${String(secs).padStart(2, "0")}`
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return "Invalid date"
      
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return "Invalid date"
    }
  }

  const filteredRecordings = recordings.filter(
    (rec) =>
      rec.to_number?.includes(searchTerm) ||
      rec.from_number?.includes(searchTerm) ||
      rec.call_id?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-6 bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Volume2 className="w-6 h-6 text-purple-500" />
              Recording Manager
            </h2>
            <div className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
              <span>Manage and playback call recordings</span>
              {!demoMode && (
                <span className={`inline-flex items-center gap-1 text-xs ${wsConnected ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-green-600 animate-pulse' : 'bg-amber-600'}`} />
                  {wsConnected ? 'Live' : 'Offline'}
                </span>
              )}
            </div>
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
          <p className="text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Demo Mode: Using sample recordings for demonstration
          </p>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20 hover:border-blue-500/40 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Volume2 className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-medium">Total Recordings</p>
              <p className="text-2xl font-bold text-foreground">{recordings.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20 hover:border-green-500/40 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <HardDrive className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-medium">Total Storage</p>
              <p className="text-2xl font-bold text-foreground">{formatBytes(totalSize)}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20 hover:border-purple-500/40 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Clock className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase font-medium">Total Duration</p>
              <p className="text-2xl font-bold text-foreground">
                {formatDuration(recordings.reduce((sum, rec) => sum + (rec.duration || 0), 0))}
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
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <p className="text-destructive text-sm font-medium">{error}</p>
          </div>
        </Card>
      )}

      {/* Audio Error Display */}
      {audioError && (
        <Card className="p-4 bg-amber-500/10 border-amber-500/20">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600" />
            <p className="text-amber-600 dark:text-amber-400 text-sm font-medium">{audioError}</p>
          </div>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
          <p className="text-muted-foreground text-sm font-medium">Loading recordings...</p>
        </Card>
      )}

      {/* Recordings List */}
      {!loading && (
        <div className="space-y-3">
          {filteredRecordings.length === 0 ? (
            <Card className="p-12 text-center">
              <Volume2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground font-medium">
                {searchTerm ? "No recordings found matching your search" : "No recordings yet"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchTerm ? "Try a different search term" : "Call recordings will appear here automatically"}
              </p>
            </Card>
          ) : (
            filteredRecordings.map((recording) => (
              <Card
                key={recording.call_id}
                className={`p-4 transition-all ${
                  playingId === recording.call_id
                    ? "bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30 shadow-lg"
                    : "hover:border-border/50"
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  {/* Recording Info */}
                  <div className="flex-1 min-w-0 w-full">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="font-bold font-mono text-lg text-foreground">{recording.to_number}</p>
                      {playingId === recording.call_id && (
                        <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full flex items-center gap-1.5 font-medium">
                          <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                          Playing
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-2">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(recording.created_at)}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDuration(recording.duration)}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5" />
                        {formatBytes(recording.size)}
                      </span>
                    </div>
                    
                    <p className="text-xs text-muted-foreground">
                      From: <span className="font-mono font-medium">{recording.from_number}</span>
                    </p>

                    {/* Progress Bar */}
                    {playingId === recording.call_id && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                          <span className="font-mono">{formatDuration(currentTime)}</span>
                          <span className="font-mono">{formatDuration(duration)}</span>
                        </div>
                        <div
                          ref={progressBarRef}
                          onClick={handleProgressBarClick}
                          className="w-full bg-secondary rounded-full h-2 cursor-pointer hover:h-3 transition-all group"
                        >
                          <div
                            className="bg-primary h-2 rounded-full transition-all group-hover:h-3 relative"
                            style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                          >
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      onClick={() => handleTogglePlay(recording)}
                      size="sm"
                      variant={playingId === recording.call_id ? "default" : "secondary"}
                      className="gap-2 flex-1 sm:flex-none"
                      title={playingId === recording.call_id ? "Pause" : "Play"}
                    >
                      {playingId === recording.call_id ? (
                        <>
                          <Pause className="w-4 h-4" />
                          <span className="sm:inline hidden">Pause</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          <span className="sm:inline hidden">Play</span>
                        </>
                      )}
                    </Button>

                    <Button
                      onClick={() => handleDownload(recording)}
                      size="sm"
                      variant="secondary"
                      title="Download"
                      className="flex-1 sm:flex-none"
                    >
                      <Download className="w-4 h-4" />
                    </Button>

                    <Button
                      onClick={() => handleDelete(recording.call_id)}
                      size="sm"
                      variant="destructive"
                      title="Delete"
                      className="flex-1 sm:flex-none"
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
            Showing <span className="font-semibold text-foreground">{filteredRecordings.length}</span> of{" "}
            <span className="font-semibold text-foreground">{recordings.length}</span> recordings
          </p>
        </Card>
      )}
    </div>
  )
}
