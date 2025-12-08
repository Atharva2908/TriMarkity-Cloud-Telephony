"use client"

import { useEffect, useState, useRef, useCallback } from "react"

interface WebRTCOptions {
  apiUrl: string
  demoMode: boolean
}

interface CallState {
  call_id: string
  from_number: string
  to_number: string
  status: "dialing" | "ringing" | "active" | "ended" | "error"
  duration: number
  isMuted: boolean
  isOnHold: boolean
  speakerOn: boolean
  dtmfBuffer: string
  error?: string
}

export function useWebRTC({ apiUrl, demoMode }: WebRTCOptions) {
  const [callState, setCallState] = useState<CallState | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const durationIntervalRef = useRef<NodeJS.Timeout>()
  const mockCallTimerRef = useRef<NodeJS.Timeout>()

  // Initialize WebRTC call
  const initiateCall = useCallback(
    async (toNumber: string, fromNumber: string) => {
      if (demoMode) {
        console.log("[v0] Demo mode: Initiating simulated call", { toNumber, fromNumber })
        setCallState({
          call_id: `demo-${Date.now()}`,
          from_number: fromNumber,
          to_number: toNumber,
          status: "dialing",
          duration: 0,
          isMuted: false,
          isOnHold: false,
          speakerOn: true,
          dtmfBuffer: "",
        })

        // Simulate call progression
        mockCallTimerRef.current = setTimeout(() => {
          setCallState((prev) => (prev ? { ...prev, status: "ringing" } : null))
        }, 2000)

        mockCallTimerRef.current = setTimeout(() => {
          setCallState((prev) => (prev ? { ...prev, status: "active" } : null))
        }, 4000)

        return
      }

      try {
        setIsConnecting(true)
        const response = await fetch(`${apiUrl}/api/calls/initiate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to_number: toNumber, from_number: fromNumber }),
        })

        if (!response.ok) throw new Error("Failed to initiate call")

        const data = await response.json()
        setCallState({
          call_id: data.call_id,
          from_number: fromNumber,
          to_number: toNumber,
          status: data.status || "dialing",
          duration: 0,
          isMuted: false,
          isOnHold: false,
          speakerOn: true,
          dtmfBuffer: "",
        })
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : "Failed to initiate call"
        setCallState({
          call_id: `error-${Date.now()}`,
          from_number: fromNumber,
          to_number: toNumber,
          status: "error",
          duration: 0,
          isMuted: false,
          isOnHold: false,
          speakerOn: true,
          dtmfBuffer: "",
          error: errorMsg,
        })
      } finally {
        setIsConnecting(false)
      }
    },
    [apiUrl, demoMode],
  )

  // Toggle mute
  const toggleMute = useCallback(async () => {
    if (!callState) return

    setCallState((prev) => (prev ? { ...prev, isMuted: !prev.isMuted } : null))

    if (!demoMode && callState.status === "active") {
      try {
        await fetch(`${apiUrl}/api/calls/${callState.call_id}/mute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mute: !callState.isMuted }),
        })
      } catch (error) {
        console.error("Error toggling mute:", error)
      }
    }
  }, [callState, apiUrl, demoMode])

  // Toggle hold
  const toggleHold = useCallback(async () => {
    if (!callState) return

    setCallState((prev) => (prev ? { ...prev, isOnHold: !prev.isOnHold } : null))

    if (!demoMode && callState.status === "active") {
      try {
        await fetch(`${apiUrl}/api/calls/${callState.call_id}/hold`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hold: !callState.isOnHold }),
        })
      } catch (error) {
        console.error("Error toggling hold:", error)
      }
    }
  }, [callState, apiUrl, demoMode])

  // Send DTMF
  const sendDTMF = useCallback(
    async (digit: string) => {
      if (!callState || callState.status !== "active") return

      setCallState((prev) =>
        prev
          ? {
              ...prev,
              dtmfBuffer: prev.dtmfBuffer + digit,
            }
          : null,
      )

      if (!demoMode) {
        try {
          await fetch(`${apiUrl}/api/calls/${callState.call_id}/dtmf`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ digit }),
          })
        } catch (error) {
          console.error("Error sending DTMF:", error)
        }
      }
    },
    [callState, apiUrl, demoMode],
  )

  // Hangup call
  const hangupCall = useCallback(async () => {
    if (!callState) return

    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
    if (mockCallTimerRef.current) clearTimeout(mockCallTimerRef.current)

    if (!demoMode) {
      try {
        await fetch(`${apiUrl}/api/calls/${callState.call_id}/hangup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      } catch (error) {
        console.error("Error hanging up:", error)
      }
    }

    setCallState((prev) => (prev ? { ...prev, status: "ended" } : null))
  }, [callState, apiUrl, demoMode])

  // Clear call state
  const clearCall = useCallback(() => {
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
    if (mockCallTimerRef.current) clearTimeout(mockCallTimerRef.current)
    setCallState(null)
  }, [])

  // Handle call duration timer
  useEffect(() => {
    if (callState?.status === "active") {
      durationIntervalRef.current = setInterval(() => {
        setCallState((prev) => (prev ? { ...prev, duration: prev.duration + 1 } : null))
      }, 1000)

      return () => clearInterval(durationIntervalRef.current)
    }
  }, [callState?.status])

  return {
    callState,
    isConnecting,
    initiateCall,
    toggleMute,
    toggleHold,
    sendDTMF,
    hangupCall,
    clearCall,
  }
}
