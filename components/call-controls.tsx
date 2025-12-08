"use client"

import { useState } from "react"
import { Mic, MicOff, Pause, Play, Smartphone, Volume2, VolumeX, Circle } from "lucide-react"
import { useApiConfig } from "@/hooks/use-api-config"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface CallControlsProps {
  callState: any
  onMute?: () => void
  onHold?: () => void
  onDTMF?: (digit: string) => void
  onHangup?: () => void
  onToggleSpeaker?: () => void
  onToggleRecording?: () => void
}

export function CallControls({ 
  callState, 
  onMute, 
  onHold, 
  onDTMF, 
  onHangup,
  onToggleSpeaker,
  onToggleRecording 
}: CallControlsProps) {
  const { apiUrl } = useApiConfig()
  const [showDTMF, setShowDTMF] = useState(false)
  const [dtmfBuffer, setDtmfBuffer] = useState<string[]>([])

  if (!callState || callState.status !== "active") return null

  const dtmfPad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"]

  const handleDTMF = async (digit: string) => {
    // Add to buffer for display
    setDtmfBuffer(prev => [...prev, digit].slice(-10)) // Keep last 10 digits

    // Send DTMF to backend
    try {
      await fetch(`${apiUrl}/api/webrtc/dtmf/${callState.call_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ digit }),
      })
    } catch (error) {
      console.error("Failed to send DTMF:", error)
    }

    // Also trigger callback if provided
    if (onDTMF) {
      onDTMF(digit)
    }
  }

  const handleMute = async () => {
    try {
      await fetch(`${apiUrl}/api/webrtc/mute/${callState.call_id}`, {
        method: "POST",
      })
    } catch (error) {
      console.error("Failed to toggle mute:", error)
    }
    
    if (onMute) {
      onMute()
    }
  }

  const handleHold = async () => {
    try {
      await fetch(`${apiUrl}/api/webrtc/hold/${callState.call_id}`, {
        method: "POST",
      })
    } catch (error) {
      console.error("Failed to toggle hold:", error)
    }
    
    if (onHold) {
      onHold()
    }
  }

  const handleToggleRecording = async () => {
    try {
      await fetch(`${apiUrl}/api/webrtc/recording/${callState.call_id}`, {
        method: "POST",
      })
    } catch (error) {
      console.error("Failed to toggle recording:", error)
    }
    
    if (onToggleRecording) {
      onToggleRecording()
    }
  }

  const clearDtmfBuffer = () => {
    setDtmfBuffer([])
  }

  return (
    <Card className="p-6 space-y-4 bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-900/80 border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg text-slate-50">Call Controls</h3>
        <div className="flex items-center gap-2">
          <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500 animate-pulse" />
          <span className="text-xs text-slate-400">Active Call</span>
        </div>
      </div>

      {/* Primary Controls */}
      <div className="flex flex-wrap justify-center gap-3">
        {/* Mute Button */}
        <Button
          onClick={handleMute}
          title={callState.isMuted ? "Unmute" : "Mute"}
          size="lg"
          variant={callState.isMuted ? "destructive" : "secondary"}
          className={`h-14 w-14 rounded-full ${
            callState.isMuted 
              ? "bg-rose-500 hover:bg-rose-600 text-white" 
              : "bg-slate-800 hover:bg-slate-700 text-slate-100"
          }`}
        >
          {callState.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </Button>

        {/* DTMF Keypad Toggle */}
        <Button
          onClick={() => setShowDTMF(!showDTMF)}
          title="DTMF Keypad"
          size="lg"
          variant="secondary"
          className={`h-14 w-14 rounded-full ${
            showDTMF
              ? "bg-sky-500 hover:bg-sky-600 text-white"
              : "bg-slate-800 hover:bg-slate-700 text-slate-100"
          }`}
        >
          <Smartphone className="w-6 h-6" />
        </Button>

        {/* Hold Button */}
        <Button
          onClick={handleHold}
          title={callState.isOnHold ? "Resume" : "Hold"}
          size="lg"
          variant={callState.isOnHold ? "destructive" : "secondary"}
          className={`h-14 w-14 rounded-full ${
            callState.isOnHold 
              ? "bg-amber-500 hover:bg-amber-600 text-white" 
              : "bg-slate-800 hover:bg-slate-700 text-slate-100"
          }`}
        >
          {callState.isOnHold ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
        </Button>

        {/* Speaker Toggle */}
        {onToggleSpeaker && (
          <Button
            onClick={onToggleSpeaker}
            title={callState.speakerOn ? "Speaker Off" : "Speaker On"}
            size="lg"
            variant="secondary"
            className={`h-14 w-14 rounded-full ${
              callState.speakerOn
                ? "bg-blue-500 hover:bg-blue-600 text-white"
                : "bg-slate-800 hover:bg-slate-700 text-slate-100"
            }`}
          >
            {callState.speakerOn ? <Volume2 className="w-6 h-6" /> : <VolumeX className="w-6 h-6" />}
          </Button>
        )}

        {/* Recording Indicator */}
        {onToggleRecording && (
          <Button
            onClick={handleToggleRecording}
            title={callState.isRecording ? "Stop Recording" : "Start Recording"}
            size="lg"
            variant="secondary"
            className={`h-14 w-14 rounded-full ${
              callState.isRecording
                ? "bg-rose-500 hover:bg-rose-600 text-white animate-pulse"
                : "bg-slate-800 hover:bg-slate-700 text-slate-100"
            }`}
          >
            <Circle className={`w-4 h-4 ${callState.isRecording ? "fill-white" : ""}`} />
          </Button>
        )}
      </div>

      {/* Call Info */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
        <div className="text-center">
          <p className="text-xs text-slate-400">Status</p>
          <p className="text-sm font-semibold text-emerald-300">
            {callState.isOnHold ? "On Hold" : "Active"}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-slate-400">Audio</p>
          <p className="text-sm font-semibold text-slate-100">
            {callState.isMuted ? "Muted" : "Unmuted"}
          </p>
        </div>
      </div>

      {/* DTMF Keypad */}
      {showDTMF && (
        <div className="space-y-3 pt-4 border-t border-white/10">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-100">DTMF Keypad</p>
            {dtmfBuffer.length > 0 && (
              <Button
                onClick={clearDtmfBuffer}
                variant="ghost"
                size="sm"
                className="text-xs text-slate-400 hover:text-slate-100"
              >
                Clear
              </Button>
            )}
          </div>
          
          {/* DTMF Display */}
          <div className="bg-slate-950/60 rounded-lg border border-white/10 p-3 min-h-[40px] flex items-center justify-center">
            <span className="font-mono text-lg text-slate-100">
              {dtmfBuffer.length > 0 ? dtmfBuffer.join(" ") : "---"}
            </span>
          </div>

          {/* DTMF Grid */}
          <div className="grid grid-cols-3 gap-2">
            {dtmfPad.map((digit) => (
              <Button
                key={digit}
                onClick={() => handleDTMF(digit)}
                variant="secondary"
                className="h-12 bg-slate-800 hover:bg-slate-700 active:bg-sky-500 text-slate-100 font-bold text-lg transition-colors"
              >
                {digit}
              </Button>
            ))}
          </div>

          <p className="text-xs text-slate-400 text-center">
            Tap digits to send DTMF tones during call
          </p>
        </div>
      )}

      {/* Recording Status */}
      {callState.isRecording && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
          <div className="flex items-center gap-2">
            <Circle className="w-2 h-2 fill-rose-500 text-rose-500 animate-pulse" />
            <p className="text-sm text-rose-300 font-medium">
              Call is being recorded
            </p>
          </div>
        </div>
      )}
    </Card>
  )
}
