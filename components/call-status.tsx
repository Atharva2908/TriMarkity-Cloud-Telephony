"use client"

import { useEffect, useState } from "react"
import { PhoneOff, Pause, Play, Mic, MicOff, Volume2, VolumeX, Circle } from "lucide-react"
import { useApiConfig } from "@/hooks/use-api-config"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface CallStatusProps {
  call: {
    call_id: string
    from_number: string
    to_number: string
    status: string
    duration?: number
    isMuted?: boolean
    speakerOn?: boolean
    isOnHold?: boolean
    isRecording?: boolean
  }
  onHangup?: () => void
  onMute?: () => void
  onHold?: () => void
  onSpeaker?: () => void
}

export function CallStatus({ call, onHangup, onMute, onHold, onSpeaker }: CallStatusProps) {
  const { apiUrl } = useApiConfig()
  const [duration, setDuration] = useState(call.duration || 0)
  const [isMuted, setIsMuted] = useState(call.isMuted || false)
  const [speakerOn, setSpeakerOn] = useState(call.speakerOn ?? true)
  const [isOnHold, setIsOnHold] = useState(call.isOnHold || false)

  // Sync with parent call state
  useEffect(() => {
    setDuration(call.duration || 0)
    setIsMuted(call.isMuted || false)
    setSpeakerOn(call.speakerOn ?? true)
    setIsOnHold(call.isOnHold || false)
  }, [call])

  // Timer for active calls
  useEffect(() => {
    if (call.status !== "active") return

    const timer = setInterval(() => {
      setDuration((d) => d + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [call.status])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const statusColors = {
    dialing: "text-amber-500",
    ringing: "text-blue-500",
    active: "text-green-500",
    ended: "text-rose-500",
    failed: "text-red-500",
    hold: "text-orange-500",
  }

  const statusLabels = {
    dialing: "Dialing...",
    ringing: "Ringing...",
    active: "Connected",
    ended: "Call Ended",
    failed: "Call Failed",
    hold: "On Hold",
  }

  const handleMute = async () => {
    try {
      await fetch(`${apiUrl}/api/webrtc/mute/${call.call_id}`, {
        method: "POST",
      })
      setIsMuted(!isMuted)
      onMute?.()
    } catch (error) {
      console.error("Failed to toggle mute:", error)
    }
  }

  const handleHold = async () => {
    try {
      await fetch(`${apiUrl}/api/webrtc/hold/${call.call_id}`, {
        method: "POST",
      })
      setIsOnHold(!isOnHold)
      onHold?.()
    } catch (error) {
      console.error("Failed to toggle hold:", error)
    }
  }

  const handleSpeaker = () => {
    setSpeakerOn(!speakerOn)
    onSpeaker?.()
  }

  const handleHangup = async () => {
    try {
      await fetch(`${apiUrl}/api/webrtc/hangup/${call.call_id}`, {
        method: "POST",
      })
      onHangup?.()
    } catch (error) {
      console.error("Failed to hangup:", error)
    }
  }

  return (
    <Card className="p-8 bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-900/80 border-white/10">
      <div className="space-y-8">
        {/* Call Status Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2">
            <Circle
              className={`w-3 h-3 ${
                call.status === "active"
                  ? "fill-green-500 text-green-500 animate-pulse"
                  : call.status === "ringing"
                  ? "fill-blue-500 text-blue-500 animate-pulse"
                  : "fill-gray-500 text-gray-500"
              }`}
            />
            <div
              className={`text-sm font-semibold uppercase tracking-wide ${
                statusColors[call.status as keyof typeof statusColors] || "text-slate-400"
              }`}
            >
              {statusLabels[call.status as keyof typeof statusLabels] || call.status}
            </div>
          </div>

          {/* Phone Number */}
          <div className="text-4xl font-bold text-slate-50 font-mono">{call.to_number}</div>

          {/* From Number */}
          <div className="text-sm text-slate-400">
            From: <span className="font-mono">{call.from_number}</span>
          </div>

          {/* Duration Timer */}
          {(call.status === "active" || call.status === "hold") && (
            <div className="text-5xl font-mono font-bold text-emerald-300 animate-pulse">
              {formatTime(duration)}
            </div>
          )}

          {/* Recording Indicator */}
          {call.isRecording && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-500/20 border border-rose-500/40 rounded-full">
              <Circle className="w-2 h-2 fill-rose-500 text-rose-500 animate-pulse" />
              <span className="text-xs text-rose-300 font-medium">Recording</span>
            </div>
          )}
        </div>

        {/* Call Controls */}
        {(call.status === "active" || call.status === "hold") && (
          <div className="flex flex-wrap justify-center gap-3">
            {/* Mute Button */}
            <Button
              onClick={handleMute}
              size="lg"
              variant={isMuted ? "destructive" : "secondary"}
              className={`h-16 w-16 rounded-full ${
                isMuted
                  ? "bg-rose-500 hover:bg-rose-600 text-white"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-100"
              }`}
              title={isMuted ? "Unmute" : "Mute"}
            >
              {isMuted ? <MicOff className="w-7 h-7" /> : <Mic className="w-7 h-7" />}
            </Button>

            {/* Speaker Button */}
            <Button
              onClick={handleSpeaker}
              size="lg"
              variant="secondary"
              className={`h-16 w-16 rounded-full ${
                speakerOn
                  ? "bg-blue-500 hover:bg-blue-600 text-white"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-100"
              }`}
              title={speakerOn ? "Speaker On" : "Speaker Off"}
            >
              {speakerOn ? <Volume2 className="w-7 h-7" /> : <VolumeX className="w-7 h-7" />}
            </Button>

            {/* Hold Button */}
            <Button
              onClick={handleHold}
              size="lg"
              variant={isOnHold ? "destructive" : "secondary"}
              className={`h-16 w-16 rounded-full ${
                isOnHold
                  ? "bg-amber-500 hover:bg-amber-600 text-white"
                  : "bg-slate-800 hover:bg-slate-700 text-slate-100"
              }`}
              title={isOnHold ? "Resume" : "Hold"}
            >
              {isOnHold ? <Play className="w-7 h-7" /> : <Pause className="w-7 h-7" />}
            </Button>

            {/* Hangup Button */}
            <Button
              onClick={handleHangup}
              size="lg"
              className="h-16 w-16 rounded-full bg-gradient-to-r from-rose-500 to-red-600 hover:opacity-90 text-white ml-4"
              title="End Call"
            >
              <PhoneOff className="w-7 h-7" />
            </Button>
          </div>
        )}

        {/* Call Details */}
        <div className="bg-slate-950/60 rounded-lg border border-white/10 p-4 space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Call ID:</span>
            <span className="font-mono text-slate-100 text-xs">
              {call.call_id.length > 16 ? `${call.call_id.substring(0, 16)}...` : call.call_id}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Status:</span>
            <span className="capitalize text-slate-100 font-medium">{call.status}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Duration:</span>
            <span className="font-mono text-slate-100">{formatTime(duration)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Audio:</span>
            <span className="text-slate-100">
              {isMuted ? "🔇 Muted" : "🎤 Active"} • {speakerOn ? "🔊 Speaker" : "🎧 Earpiece"}
            </span>
          </div>
          {isOnHold && (
            <div className="pt-2 border-t border-white/10">
              <div className="flex items-center justify-center gap-2 text-amber-400">
                <Pause className="w-4 h-4" />
                <span className="text-sm font-medium">Call is on hold</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  )
}
