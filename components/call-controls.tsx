"use client"

import { useState } from "react"
import { Mic, MicOff, Pause, Play, Smartphone } from "lucide-react"

interface CallControlsProps {
  callState: any
  onMute?: () => void
  onHold?: () => void
  onDTMF?: (digit: string) => void
  onHangup?: () => void
}

export function CallControls({ callState, onMute, onHold, onDTMF, onHangup }: CallControlsProps) {
  const [showDTMF, setShowDTMF] = useState(false)

  if (!callState || callState.status !== "active") return null

  const dtmfPad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"]

  return (
    <div className="bg-card rounded-lg border border-border p-6 space-y-4">
      <h3 className="font-bold text-lg">Call Controls</h3>

      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={onMute}
          title={callState.isMuted ? "Unmute" : "Mute"}
          className={`p-4 rounded-full transition-colors ${
            callState.isMuted ? "bg-destructive text-destructive-foreground" : "bg-secondary hover:bg-secondary/80"
          }`}
        >
          {callState.isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </button>

        <button
          onClick={() => setShowDTMF(!showDTMF)}
          title="DTMF Keypad"
          className="p-4 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
        >
          <Smartphone className="w-6 h-6" />
        </button>

        <button
          onClick={onHold}
          title={callState.isOnHold ? "Resume" : "Hold"}
          className={`p-4 rounded-full transition-colors ${
            callState.isOnHold ? "bg-destructive text-destructive-foreground" : "bg-secondary hover:bg-secondary/80"
          }`}
        >
          {callState.isOnHold ? <Play className="w-6 h-6" /> : <Pause className="w-6 h-6" />}
        </button>
      </div>

      {showDTMF && (
        <div className="space-y-3 pt-4 border-t border-border">
          <p className="text-sm font-semibold">DTMF Keypad</p>
          <div className="grid grid-cols-3 gap-2">
            {dtmfPad.map((digit) => (
              <button
                key={digit}
                onClick={() => onDTMF?.(digit)}
                className="bg-secondary hover:bg-secondary/80 active:bg-accent active:text-accent-foreground rounded-lg p-3 font-bold transition-colors"
              >
                {digit}
              </button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">Sent: {callState.dtmfBuffer || "None"}</div>
        </div>
      )}
    </div>
  )
}
