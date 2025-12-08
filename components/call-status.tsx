"use client"

import { useEffect, useState } from "react"
import { PhoneOff, Pause, Mic, MicOff, Volume2, VolumeX } from "lucide-react"

interface CallStatusProps {
  call: {
    call_id: string
    from_number: string
    to_number: string
    status: string
  }
}

export function CallStatus({ call }: CallStatusProps) {
  const [duration, setDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [speakerOn, setSpeakerOn] = useState(true)
  const [isOnHold, setIsOnHold] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setDuration((d) => d + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const statusColors = {
    dialing: "text-ring",
    ringing: "text-blue-500",
    active: "text-green-500",
    ended: "text-destructive",
  }

  return (
    <div className="bg-card rounded-lg border border-border p-8">
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <div
            className={`text-sm font-mono ${statusColors[call.status as keyof typeof statusColors] || "text-muted-foreground"}`}
          >
            {call.status.toUpperCase()}
          </div>

          <div className="text-3xl font-bold">{call.to_number}</div>

          <div className="text-sm text-muted-foreground">From: {call.from_number}</div>

          {call.status === "active" && (
            <div className="text-4xl font-mono font-bold text-accent">{formatTime(duration)}</div>
          )}
        </div>

        {call.status === "active" && (
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-4 rounded-full ${isMuted ? "bg-destructive text-destructive-foreground" : "bg-secondary hover:bg-secondary/80"} transition-colors`}
              title="Mute"
            >
              {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
            </button>

            <button
              onClick={() => setSpeakerOn(!speakerOn)}
              className={`p-4 rounded-full ${speakerOn ? "bg-secondary hover:bg-secondary/80" : "bg-destructive text-destructive-foreground"} transition-colors`}
              title="Speaker"
            >
              {speakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
            </button>

            <button
              onClick={() => setIsOnHold(!isOnHold)}
              className={`p-4 rounded-full ${isOnHold ? "bg-destructive text-destructive-foreground" : "bg-secondary hover:bg-secondary/80"} transition-colors`}
              title="Hold"
            >
              <Pause className="w-6 h-6" />
            </button>

            <button
              className="p-4 rounded-full bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity ml-4"
              title="End Call"
            >
              <PhoneOff className="w-6 h-6" />
            </button>
          </div>
        )}

        <div className="bg-input rounded-lg p-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Call ID:</span>
            <span className="font-mono">{call.call_id.substring(0, 12)}...</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status:</span>
            <span className="capitalize">{call.status}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Duration:</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
