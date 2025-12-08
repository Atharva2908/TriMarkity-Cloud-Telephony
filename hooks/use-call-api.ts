"use client"

import { useEffect, useState, useCallback, useRef } from "react"

export type CallStatus =
  | "dialing"
  | "ringing"
  | "active"
  | "hold"
  | "ended"
  | "failed"

export interface CallState {
  call_id: string
  from_number: string
  to_number: string
  status: CallStatus
  duration: number
  isMuted: boolean
  isOnHold: boolean
  speakerOn: boolean
  isRecording: boolean
  error?: string
}

interface UseCallApiOptions {
  apiUrl: string
  pollInterval?: number
}

export function useCallApi({ apiUrl, pollInterval = 1000 }: UseCallApiOptions) {
  const [callState, setCallState] = useState<CallState | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearTimers = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
    pollIntervalRef.current = null
    durationIntervalRef.current = null
  }

  const fetchCallStatus = useCallback(
    async (callId: string) => {
      try {
        const response = await fetch(
          `${apiUrl}/api/webrtc/status/${callId}`,
        )
        if (!response.ok) return null
        return await response.json()
      } catch (error) {
        console.error("[useCallApi] Error fetching call status:", error)
        return null
      }
    },
    [apiUrl],
  )

  const initiateCall = useCallback(
    async (toNumber: string, fromNumber: string) => {
      setIsConnecting(true)
      try {
        const response = await fetch(
          `${apiUrl}/api/webrtc/initiate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to_number: toNumber,
              from_number: fromNumber,
            }),
          },
        )

        if (!response.ok) {
          let errorMsg = "Failed to initiate call"
          try {
            const error = await response.json()
            errorMsg = error.detail || errorMsg
          } catch {
            /* ignore */
          }
          throw new Error(errorMsg)
        }

        const data = await response.json()

        const newCallState: CallState = {
          call_id: data.call_id,
          from_number: data.from || fromNumber,
          to_number: data.to || toNumber,
          status: (data.status as CallStatus) ?? "dialing",
          duration: 0,
          isMuted: false,
          isOnHold: false,
          speakerOn: true,
          isRecording: false,
        }

        setCallState(newCallState)

        clearTimers()
        pollIntervalRef.current = setInterval(async () => {
          const status = await fetchCallStatus(data.call_id)
          if (status) {
            const rawStatus = status.status as string

            const normalizedStatus: CallStatus =
              rawStatus === "completed" || rawStatus === "hangup"
                ? "ended"
                : ((rawStatus as CallStatus) || newCallState.status)

            setCallState((prev) =>
              prev
                ? {
                    ...prev,
                    status: normalizedStatus,
                    isRecording: status.is_recording ?? prev.isRecording, // Sync recording state
                  }
                : null,
            )

            if (
              rawStatus === "ended" ||
              rawStatus === "failed" ||
              rawStatus === "completed" ||
              rawStatus === "hangup"
            ) {
              clearTimers()
            }
          }
        }, pollInterval)

        return newCallState
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Failed to initiate call"
        setCallState({
          call_id: `error-${Date.now()}`,
          from_number: "",
          to_number: toNumber,
          status: "failed",
          duration: 0,
          isMuted: false,
          isOnHold: false,
          speakerOn: true,
          isRecording: false,
          error: errorMsg,
        })
        throw error
      } finally {
        setIsConnecting(false)
      }
    },
    [apiUrl, fetchCallStatus, pollInterval],
  )

  const toggleMute = useCallback(async () => {
    if (!callState) return
    const targetMute = !callState.isMuted

    setCallState((prev) => (prev ? { ...prev, isMuted: targetMute } : null))

    // WebRTC client handles actual muting in dialer-screen.tsx
    try {
      await Promise.resolve()
    } catch (error) {
      console.error("[useCallApi] Error toggling mute:", error)
      setCallState((prev) => (prev ? { ...prev, isMuted: !targetMute } : null))
    }
  }, [callState])

  const toggleHold = useCallback(async () => {
    if (!callState) return
    const targetHold = !callState.isOnHold

    setCallState((prev) => (prev ? { ...prev, isOnHold: targetHold } : null))

    try {
      const res = await fetch(
        `${apiUrl}/api/telnyx/${callState.call_id}/hold`,
        {
          method: "POST",
        },
      )
      if (!res.ok) throw new Error("Hold failed")
    } catch (error) {
      console.error("[useCallApi] Error toggling hold:", error)
      setCallState((prev) => (prev ? { ...prev, isOnHold: !targetHold } : null))
    }
  }, [callState, apiUrl])

  const toggleSpeaker = useCallback(async () => {
    if (!callState) return
    const targetSpeaker = !callState.speakerOn

    setCallState((prev) => (prev ? { ...prev, speakerOn: targetSpeaker } : null))

    // UI-only, no backend endpoint needed
    try {
      await Promise.resolve()
    } catch (error) {
      console.error("[useCallApi] Error toggling speaker (UI only):", error)
      setCallState((prev) =>
        prev ? { ...prev, speakerOn: !targetSpeaker } : null,
      )
    }
  }, [callState])

  const toggleRecording = useCallback(async () => {
    if (!callState) return
    
    // Only allow toggling when call is active
    if (callState.status !== "active") {
      console.warn("⚠️ Recording only available when call is active")
      return
    }
    
    const targetRecording = !callState.isRecording

    setCallState((prev) =>
      prev ? { ...prev, isRecording: targetRecording } : null,
    )

    try {
      const endpoint = targetRecording ? "recording/start" : "recording/stop"
      const response = await fetch(`${apiUrl}/api/webrtc/${endpoint}/${callState.call_id}`, {
        method: "POST",
      })
      
      if (!response.ok) {
        throw new Error(`Failed to ${targetRecording ? 'start' : 'stop'} recording`)
      }
    } catch (error) {
      console.error("[useCallApi] Error toggling recording:", error)
      // Revert state on error
      setCallState((prev) =>
        prev ? { ...prev, isRecording: !targetRecording } : null,
      )
    }
  }, [callState, apiUrl])

  const hangupCall = useCallback(async () => {
    if (!callState) return

    clearTimers()

    try {
      await fetch(
        `${apiUrl}/api/webrtc/hangup/${callState.call_id}`,
        {
          method: "POST",
        },
      )
    } catch (error) {
      console.error("[useCallApi] Error hanging up:", error)
    }

    setCallState((prev) =>
      prev
        ? {
            ...prev,
            status: "ended",
          }
        : null,
    )
  }, [callState, apiUrl])

  const clearCall = useCallback(() => {
    clearTimers()
    setCallState(null)
  }, [])

  // Duration timer: run only when call is ACTIVE (after answer)
  useEffect(() => {
    const isActive = callState?.status === "active"

    if (!isActive) {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
      return
    }

    if (!durationIntervalRef.current) {
      durationIntervalRef.current = setInterval(() => {
        setCallState((prev) =>
          prev ? { ...prev, duration: prev.duration + 1 } : null,
        )
      }, 1000)
    }

    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
      durationIntervalRef.current = null
    }
  }, [callState?.status])

  return {
    callState,
    setCallState,
    isConnecting,
    initiateCall,
    toggleMute,
    toggleHold,
    toggleSpeaker,
    toggleRecording,
    hangupCall,
    clearCall,
  }
}
