"use client"

import { useState, useCallback } from "react"
import { Phone, PhoneOff, Volume2, Pause, Loader } from "lucide-react"

interface OutboundCallingProps {
  apiUrl: string
  demoMode: boolean
}

interface OutboundCall {
  call_id: string
  to_number: string
  from_number: string
  status: "initiating" | "ringing" | "active" | "reconnecting" | "ended"
  duration: number
  is_recording: boolean
  tts_message?: string
  error?: string
}

export function OutboundCalling({ apiUrl, demoMode }: OutboundCallingProps) {
  const [call, setCall] = useState<OutboundCall | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [toNumber, setToNumber] = useState("")
  const [fromNumber, setFromNumber] = useState("+12125551234")
  const [ttsMessage, setTtsMessage] = useState("")
  const [autoReconnect, setAutoReconnect] = useState(true)
  const [autoHangup, setAutoHangup] = useState(60) // 60 seconds

  const handleInitiateCall = useCallback(async () => {
    if (!toNumber) return

    setIsLoading(true)
    try {
      if (demoMode) {
        setCall({
          call_id: `demo-${Date.now()}`,
          to_number: toNumber,
          from_number: fromNumber,
          status: "initiating",
          duration: 0,
          is_recording: false,
        })
        setTimeout(() => {
          setCall((prev) => (prev ? { ...prev, status: "ringing" } : null))
        }, 1500)
        setTimeout(() => {
          setCall((prev) => (prev ? { ...prev, status: "active" } : null))
        }, 3000)
      } else {
        const response = await fetch(`${apiUrl}/api/calls/outbound/initiate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to_number: toNumber,
            from_number: fromNumber,
            tts_message: ttsMessage || undefined,
            auto_reconnect: autoReconnect,
            auto_hangup_duration: autoHangup,
          }),
        })

        if (!response.ok) throw new Error("Failed to initiate call")

        const data = await response.json()
        setCall({
          call_id: data.call_id,
          to_number: toNumber,
          from_number: fromNumber,
          status: data.status,
          duration: 0,
          is_recording: false,
        })
      }
    } catch (error) {
      console.error("Error initiating call:", error)
      setCall({
        call_id: `error-${Date.now()}`,
        to_number: toNumber,
        from_number: fromNumber,
        status: "ended",
        duration: 0,
        is_recording: false,
        error: error instanceof Error ? error.message : "Failed to initiate call",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toNumber, fromNumber, ttsMessage, autoReconnect, autoHangup, apiUrl, demoMode])

  const handleHangup = useCallback(async () => {
    if (!call) return

    try {
      if (!demoMode) {
        await fetch(`${apiUrl}/api/calls/${call.call_id}/hangup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      }
      setCall(null)
      setToNumber("")
    } catch (error) {
      console.error("Error hanging up:", error)
    }
  }, [call, apiUrl, demoMode])

  const handleToggleRecording = useCallback(async () => {
    if (!call || call.status !== "active") return

    try {
      if (!demoMode) {
        const endpoint = call.is_recording
          ? `/api/calls/${call.call_id}/recording/stop`
          : `/api/calls/${call.call_id}/recording/start`

        await fetch(`${apiUrl}${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      }

      setCall((prev) => (prev ? { ...prev, is_recording: !prev.is_recording } : null))
    } catch (error) {
      console.error("Error toggling recording:", error)
    }
  }, [call, apiUrl, demoMode])

  if (call) {
    return (
      <div className="bg-card rounded-lg border border-border p-6 space-y-4">
        <h2 className="text-xl font-bold">Active Call</h2>

        <div className="bg-input rounded-lg p-4 space-y-4">
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">
              {call.status === "initiating" && "Initiating..."}
              {call.status === "ringing" && "Ringing..."}
              {call.status === "active" && "Connected"}
              {call.status === "reconnecting" && "Reconnecting..."}
              {call.status === "ended" && "Call Ended"}
            </p>
            <p className="text-3xl font-mono font-bold">{call.to_number}</p>
            <p className="text-sm text-muted-foreground mt-2">From: {call.from_number}</p>
          </div>

          {call.status === "active" && (
            <div className="text-center">
              <p className="text-4xl font-mono font-bold text-accent">
                {String(Math.floor(call.duration / 60)).padStart(2, "0")}:{String(call.duration % 60).padStart(2, "0")}
              </p>
              {call.is_recording && (
                <p className="text-sm text-destructive mt-2 flex items-center justify-center gap-2">
                  <div className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
                  Recording
                </p>
              )}
            </div>
          )}
        </div>

        {call.status === "active" && (
          <div className="flex gap-2">
            <button
              onClick={handleToggleRecording}
              className={`flex-1 p-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors ${
                call.is_recording
                  ? "bg-destructive text-destructive-foreground hover:opacity-90"
                  : "bg-secondary hover:bg-secondary/80"
              }`}
            >
              {call.is_recording ? (
                <>
                  <Pause className="w-5 h-5" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Volume2 className="w-5 h-5" />
                  Start Recording
                </>
              )}
            </button>
          </div>
        )}

        <button
          onClick={handleHangup}
          className="w-full bg-destructive text-destructive-foreground hover:opacity-90 rounded-lg p-3 font-bold flex items-center justify-center gap-2 transition-opacity"
        >
          <PhoneOff className="w-5 h-5" />
          End Call
        </button>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg border border-border p-6 space-y-4">
      <h2 className="text-xl font-bold">Outbound Calling</h2>

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">To Number</label>
          <input
            type="tel"
            value={toNumber}
            onChange={(e) => setToNumber(e.target.value)}
            placeholder="+1234567890"
            disabled={isLoading}
            className="w-full bg-input border border-border rounded-lg p-2 mt-1 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="text-sm font-medium">From Number</label>
          <select
            value={fromNumber}
            onChange={(e) => setFromNumber(e.target.value)}
            disabled={isLoading}
            className="w-full bg-input border border-border rounded-lg p-2 mt-1 disabled:opacity-50"
          >
            <option value="+12125551234">+1 (212) 555-1234</option>
            <option value="+14155551234">+1 (415) 555-1234</option>
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">TTS Message (Optional)</label>
          <textarea
            value={ttsMessage}
            onChange={(e) => setTtsMessage(e.target.value)}
            placeholder="Message to play when call is answered"
            disabled={isLoading}
            className="w-full bg-input border border-border rounded-lg p-2 mt-1 disabled:opacity-50 h-20 resize-none"
          />
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoReconnect}
              onChange={(e) => setAutoReconnect(e.target.checked)}
              disabled={isLoading}
              className="w-4 h-4"
            />
            <span className="text-sm">Auto-Reconnect on Failure</span>
          </label>

          <div>
            <label className="text-sm font-medium">Auto Hangup (seconds)</label>
            <input
              type="number"
              min="30"
              max="600"
              value={autoHangup}
              onChange={(e) => setAutoHangup(Number(e.target.value))}
              disabled={isLoading}
              className="w-full bg-input border border-border rounded-lg p-2 mt-1 disabled:opacity-50"
            />
            <p className="text-xs text-muted-foreground mt-1">Call will automatically end after this duration</p>
          </div>
        </div>
      </div>

      <button
        onClick={handleInitiateCall}
        disabled={!toNumber || isLoading}
        className="w-full bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-50 rounded-lg p-3 font-bold flex items-center justify-center gap-2 transition-opacity"
      >
        {isLoading ? (
          <>
            <Loader className="w-5 h-5 animate-spin" />
            Initiating...
          </>
        ) : (
          <>
            <Phone className="w-5 h-5" />
            Call
          </>
        )}
      </button>
    </div>
  )
}
