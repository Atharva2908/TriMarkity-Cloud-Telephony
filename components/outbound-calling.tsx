"use client"

import { useState, useCallback, useEffect } from "react"
import { Phone, PhoneOff, Volume2, Pause, Loader2, Circle, Mic, MicOff } from "lucide-react"
import { useApiConfig } from "@/hooks/use-api-config"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"

interface OutboundCallingProps {
  demoMode?: boolean
}

interface OutboundCall {
  call_id: string
  to_number: string
  from_number: string
  status: "initiating" | "ringing" | "active" | "reconnecting" | "ended" | "failed"
  duration: number
  is_recording: boolean
  is_muted?: boolean
  tts_message?: string
  error?: string
}

export function OutboundCalling({ demoMode = false }: OutboundCallingProps) {
  const { apiUrl } = useApiConfig()
  const [call, setCall] = useState<OutboundCall | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [toNumber, setToNumber] = useState("")
  const [fromNumber, setFromNumber] = useState("")
  const [availableNumbers, setAvailableNumbers] = useState<string[]>([])
  const [ttsMessage, setTtsMessage] = useState("")
  const [autoReconnect, setAutoReconnect] = useState(true)
  const [autoHangup, setAutoHangup] = useState(60)
  const [error, setError] = useState<string | null>(null)
  const [isHangingUp, setIsHangingUp] = useState(false)

  // Fetch available numbers
  useEffect(() => {
    const fetchNumbers = async () => {
      try {
        const res = await fetch(`${apiUrl}/api/numbers/`)
        if (res.ok) {
          const data = await res.json()
          const numbers = data.numbers || []
          setAvailableNumbers(numbers.map((n: any) => n.phone_number))
          if (numbers.length > 0 && !fromNumber) {
            setFromNumber(numbers[0].phone_number)
          }
        }
      } catch (err) {
        console.error("Failed to fetch phone numbers:", err)
      }
    }

    if (!demoMode) {
      fetchNumbers()
    } else {
      setAvailableNumbers(["+12125551234", "+14155551234"])
      setFromNumber("+12125551234")
    }
  }, [apiUrl, demoMode, fromNumber])

  // Call duration timer
  useEffect(() => {
    if (call?.status === "active") {
      const timer = setInterval(() => {
        setCall((prev) => (prev ? { ...prev, duration: prev.duration + 1 } : null))
      }, 1000)

      return () => clearInterval(timer)
    }
  }, [call?.status])

  // Auto-hangup timer
  useEffect(() => {
    if (call?.status === "active" && autoHangup > 0) {
      const hangupTimer = setTimeout(() => {
        console.log(`⏰ Auto-hangup triggered after ${autoHangup} seconds`)
        handleHangup()
      }, autoHangup * 1000)

      return () => clearTimeout(hangupTimer)
    }
  }, [call?.status, autoHangup])

  const handleInitiateCall = useCallback(async () => {
    if (!toNumber || !fromNumber) return

    setIsLoading(true)
    setError(null)

    try {
      if (demoMode) {
        // Demo mode simulation
        setCall({
          call_id: `demo-${Date.now()}`,
          to_number: toNumber,
          from_number: fromNumber,
          status: "initiating",
          duration: 0,
          is_recording: false,
          is_muted: false,
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

        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.detail || "Failed to initiate call")
        }

        const data = await response.json()
        setCall({
          call_id: data.call_id,
          to_number: toNumber,
          from_number: fromNumber,
          status: data.status || "initiating",
          duration: 0,
          is_recording: false,
          is_muted: false,
        })
      }
    } catch (err) {
      console.error("Error initiating call:", err)
      setError(err instanceof Error ? err.message : "Failed to initiate call")
      setCall({
        call_id: `error-${Date.now()}`,
        to_number: toNumber,
        from_number: fromNumber,
        status: "failed",
        duration: 0,
        is_recording: false,
        error: err instanceof Error ? err.message : "Failed to initiate call",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toNumber, fromNumber, ttsMessage, autoReconnect, autoHangup, apiUrl, demoMode])

  // ✅ FIXED: Better hangup handling to prevent "bye failed" error
  const handleHangup = useCallback(async () => {
    if (!call || isHangingUp) {
      console.warn("⚠️ No active call or already hanging up")
      return
    }

    try {
      setIsHangingUp(true)
      console.log(`📴 Hanging up call: ${call.call_id} (status: ${call.status})`)

      // Check if call is already ended
      if (call.status === "ended" || call.status === "failed") {
        console.log("ℹ️ Call already ended, cleaning up local state only")
        setCall(null)
        setToNumber("")
        setTtsMessage("")
        setError(null)
        setIsHangingUp(false)
        return
      }

      // Call backend to hangup (backend handles idempotency)
      if (!demoMode) {
        try {
          const response = await fetch(`${apiUrl}/api/webrtc/hangup/${call.call_id}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          })

          if (response.ok) {
            const data = await response.json()
            console.log("✅ Backend hangup successful:", data)
          } else {
            const errorData = await response.json().catch(() => ({}))
            console.warn("⚠️ Backend hangup failed:", errorData)
            
            // If it's 404, the call is already gone - that's okay
            if (response.status === 404) {
              console.log("ℹ️ Call not found on backend (already ended)")
            } else {
              throw new Error(errorData.detail || "Hangup failed")
            }
          }
        } catch (backendError) {
          console.error("❌ Backend hangup error:", backendError)
          // Don't throw - we'll clean up local state anyway
        }
      }

      // Always clean up local state, regardless of backend response
      setCall(null)
      setToNumber("")
      setTtsMessage("")
      setError(null)
      
      console.log("🧹 Call cleanup complete")

    } catch (err) {
      console.error("❌ Hangup error:", err)
      setError("Failed to hang up call properly")
      
      // Force cleanup even on error
      setCall(null)
      setToNumber("")
      setTtsMessage("")
      
    } finally {
      setIsHangingUp(false)
    }
  }, [call, apiUrl, demoMode, isHangingUp])

  // ✅ FIXED: Better recording toggle with state validation
  const handleToggleRecording = useCallback(async () => {
    if (!call) {
      console.warn("⚠️ No active call")
      return
    }

    // Only allow recording toggle when call is active
    if (call.status !== "active") {
      console.warn(`⚠️ Cannot toggle recording - call is ${call.status}`)
      setError(`Cannot toggle recording - call is ${call.status}`)
      return
    }

    try {
      const newRecordingState = !call.is_recording
      console.log(`🔴 ${newRecordingState ? "Starting" : "Stopping"} recording for call ${call.call_id}`)

      if (!demoMode) {
        const endpoint = newRecordingState 
          ? `${apiUrl}/api/webrtc/recording/start/${call.call_id}`
          : `${apiUrl}/api/webrtc/recording/stop/${call.call_id}`

        const response = await fetch(endpoint, {
          method: "POST",
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.detail || "Failed to toggle recording")
        }

        console.log(`✅ Recording ${newRecordingState ? "started" : "stopped"}`)
      }

      setCall((prev) => (prev ? { ...prev, is_recording: newRecordingState } : null))
      setError(null)

    } catch (err) {
      console.error("❌ Error toggling recording:", err)
      setError(err instanceof Error ? err.message : "Failed to toggle recording")
    }
  }, [call, apiUrl, demoMode])

  // ✅ FIXED: Better mute toggle with state validation
  const handleToggleMute = useCallback(async () => {
    if (!call) {
      console.warn("⚠️ No active call")
      return
    }

    // Only allow mute toggle when call is active
    if (call.status !== "active") {
      console.warn(`⚠️ Cannot toggle mute - call is ${call.status}`)
      setError(`Cannot toggle mute - call is ${call.status}`)
      return
    }

    try {
      const newMuteState = !call.is_muted
      console.log(`🎤 ${newMuteState ? "Muting" : "Unmuting"} call ${call.call_id}`)

      if (!demoMode) {
        const response = await fetch(`${apiUrl}/api/webrtc/mute/${call.call_id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ muted: newMuteState }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.detail || "Failed to toggle mute")
        }

        console.log(`✅ ${newMuteState ? "Muted" : "Unmuted"}`)
      }

      setCall((prev) => (prev ? { ...prev, is_muted: newMuteState } : null))
      setError(null)

    } catch (err) {
      console.error("❌ Error toggling mute:", err)
      setError(err instanceof Error ? err.message : "Failed to toggle mute")
    }
  }, [call, apiUrl, demoMode])

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "initiating":
        return "text-blue-500"
      case "ringing":
        return "text-amber-500"
      case "active":
        return "text-green-500"
      case "reconnecting":
        return "text-orange-500"
      case "failed":
        return "text-red-500"
      case "ended":
        return "text-slate-500"
      default:
        return "text-slate-400"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "initiating":
        return "Initiating Call..."
      case "ringing":
        return "Ringing..."
      case "active":
        return "Connected"
      case "reconnecting":
        return "Reconnecting..."
      case "failed":
        return "Call Failed"
      case "ended":
        return "Call Ended"
      default:
        return status
    }
  }

  if (call) {
    return (
      <Card className="p-6 space-y-4 bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-900/80 border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-50">Active Call</h2>
          <div className="flex items-center gap-2">
            <Circle
              className={`w-3 h-3 ${
                call.status === "active"
                  ? "fill-green-500 text-green-500 animate-pulse"
                  : "fill-blue-500 text-blue-500 animate-pulse"
              }`}
            />
            <span className={`text-sm font-semibold ${getStatusColor(call.status)}`}>
              {getStatusLabel(call.status)}
            </span>
          </div>
        </div>

        {/* Call Info */}
        <div className="bg-slate-950/60 rounded-lg border border-white/10 p-6 space-y-4">
          <div className="text-center">
            <p className="text-4xl font-mono font-bold text-slate-50 mb-2">{call.to_number}</p>
            <p className="text-sm text-slate-400">
              From: <span className="font-mono">{call.from_number}</span>
            </p>
          </div>

          {call.status === "active" && (
            <div className="text-center pt-4 border-t border-white/10">
              <p className="text-5xl font-mono font-bold text-emerald-300 animate-pulse">
                {formatDuration(call.duration)}
              </p>
            </div>
          )}

          {/* Status Indicators */}
          <div className="flex items-center justify-center gap-4 pt-2">
            {call.is_recording && (
              <div className="flex items-center gap-2 text-rose-400">
                <Circle className="w-2 h-2 fill-rose-500 text-rose-500 animate-pulse" />
                <span className="text-xs font-medium">Recording</span>
              </div>
            )}
            {call.is_muted && (
              <div className="flex items-center gap-2 text-amber-400">
                <MicOff className="w-3 h-3" />
                <span className="text-xs font-medium">Muted</span>
              </div>
            )}
          </div>
        </div>

        {/* Call Controls */}
        {call.status === "active" && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={handleToggleMute}
              variant={call.is_muted ? "destructive" : "secondary"}
              className="h-12 gap-2"
              disabled={isHangingUp}
            >
              {call.is_muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              {call.is_muted ? "Unmute" : "Mute"}
            </Button>

            <Button
              onClick={handleToggleRecording}
              variant={call.is_recording ? "destructive" : "secondary"}
              className="h-12 gap-2"
              disabled={isHangingUp}
            >
              {call.is_recording ? <Pause className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              {call.is_recording ? "Stop Rec" : "Record"}
            </Button>
          </div>
        )}

        {/* Error Display */}
        {(call.error || error) && (
          <Card className="p-3 bg-destructive/10 border-destructive/20">
            <p className="text-destructive text-sm">{call.error || error}</p>
          </Card>
        )}

        {/* Hangup Button */}
        <Button
          onClick={handleHangup}
          disabled={isHangingUp}
          className="w-full h-14 text-lg font-bold bg-gradient-to-r from-rose-500 to-red-600 hover:opacity-90 text-white gap-2 disabled:opacity-50"
        >
          {isHangingUp ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Ending Call...
            </>
          ) : (
            <>
              <PhoneOff className="w-5 h-5" />
              End Call
            </>
          )}
        </Button>
      </Card>
    )
  }

  return (
    <Card className="p-6 space-y-4 bg-gradient-to-br from-slate-900/60 via-slate-900/40 to-slate-900/80 border-white/10">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-50">Outbound Calling</h2>
        <p className="text-sm text-slate-400 mt-1">Make automated outbound calls with TTS</p>
      </div>

      <div className="space-y-4">
        {/* To Number */}
        <div>
          <label htmlFor="to-number" className="text-sm font-medium text-slate-200 mb-2 block">
            To Number *
          </label>
          <Input
            id="to-number"
            type="tel"
            value={toNumber}
            onChange={(e) => setToNumber(e.target.value)}
            placeholder="+1234567890"
            disabled={isLoading}
            className="bg-slate-800 border-white/10 text-slate-100 font-mono placeholder:text-slate-500"
          />
        </div>

        {/* From Number */}
        <div>
          <label htmlFor="from-number" className="text-sm font-medium text-slate-200 mb-2 block">
            From Number *
          </label>
          {availableNumbers.length === 0 ? (
            <p className="text-sm text-amber-400">⚠️ No phone numbers available</p>
          ) : (
            <select
              id="from-number"
              value={fromNumber}
              onChange={(e) => setFromNumber(e.target.value)}
              disabled={isLoading}
              className="w-full bg-slate-800 border border-white/10 rounded-lg p-3 text-slate-100 font-mono disabled:opacity-50"
            >
              {availableNumbers.map((number) => (
                <option key={number} value={number}>
                  {number}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* TTS Message */}
        <div>
          <label htmlFor="tts-message" className="text-sm font-medium text-slate-200 mb-2 block">
            TTS Message (Optional)
          </label>
          <Textarea
            id="tts-message"
            value={ttsMessage}
            onChange={(e) => setTtsMessage(e.target.value)}
            placeholder="Message to play when call is answered"
            disabled={isLoading}
            className="bg-slate-800 border-white/10 text-slate-100 placeholder:text-slate-500 h-24 resize-none"
          />
          <p className="text-xs text-slate-500 mt-1">
            Text-to-speech will read this message when the call connects
          </p>
        </div>

        {/* Advanced Options */}
        <div className="space-y-3 p-4 bg-slate-950/60 rounded-lg border border-white/10">
          <h3 className="text-sm font-semibold text-slate-200">Advanced Options</h3>

          <div className="flex items-center justify-between">
            <label htmlFor="auto-reconnect" className="text-sm text-slate-300">
              Auto-Reconnect on Failure
            </label>
            <Switch
              id="auto-reconnect"
              checked={autoReconnect}
              onCheckedChange={setAutoReconnect}
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="auto-hangup" className="text-sm font-medium text-slate-200 mb-2 block">
              Auto Hangup After (seconds)
            </label>
            <Input
              id="auto-hangup"
              type="number"
              min="30"
              max="600"
              value={autoHangup}
              onChange={(e) => setAutoHangup(Number(e.target.value))}
              disabled={isLoading}
              className="bg-slate-800 border-white/10 text-slate-100"
            />
            <p className="text-xs text-slate-500 mt-1">
              Call will automatically end after this duration (30-600 seconds)
            </p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="p-3 bg-destructive/10 border-destructive/20">
            <p className="text-destructive text-sm">{error}</p>
          </Card>
        )}

        {/* Call Button */}
        <Button
          onClick={handleInitiateCall}
          disabled={!toNumber || !fromNumber || isLoading}
          className="w-full h-14 text-lg font-bold bg-gradient-to-r from-green-500 to-emerald-600 hover:opacity-90 disabled:opacity-50 text-white gap-2"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Initiating Call...
            </>
          ) : (
            <>
              <Phone className="w-5 h-5" />
              Initiate Call
            </>
          )}
        </Button>
      </div>
    </Card>
  )
}
