"use client"

import { useCallback } from "react"

interface TelnyxCallRequest {
  to_number: string
  from_number: string
  connection_id?: string
}

export function useTelnyx(apiUrl = "http://localhost:8000") {
  const initiateTelnyxCall = useCallback(
    async (request: TelnyxCallRequest) => {
      try {
        const res = await fetch(`${apiUrl}/api/telnyx/initiate-telnyx-call`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        })

        if (!res.ok) throw new Error("Failed to initiate call")
        return await res.json()
      } catch (error) {
        console.error("Error initiating Telnyx call:", error)
        throw error
      }
    },
    [apiUrl],
  )

  const hangupTelnyxCall = useCallback(
    async (callId: string) => {
      try {
        const res = await fetch(`${apiUrl}/api/telnyx/hangup-telnyx-call/${callId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })

        if (!res.ok) throw new Error("Failed to hang up call")
        return await res.json()
      } catch (error) {
        console.error("Error hanging up call:", error)
        throw error
      }
    },
    [apiUrl],
  )

  const configureWebhook = useCallback(
    async (webhookUrl: string) => {
      try {
        const res = await fetch(`${apiUrl}/api/telnyx/configure-webhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            webhook_url: webhookUrl,
            events: ["call.initiated", "call.answered", "call.ended", "call.machine_detection_ended"],
          }),
        })

        if (!res.ok) throw new Error("Failed to configure webhook")
        return await res.json()
      } catch (error) {
        console.error("Error configuring webhook:", error)
        throw error
      }
    },
    [apiUrl],
  )

  const getAvailableNumbers = useCallback(async () => {
    try {
      const res = await fetch(`${apiUrl}/api/telnyx/available-numbers`)
      if (!res.ok) throw new Error("Failed to fetch numbers")
      return await res.json()
    } catch (error) {
      console.error("Error fetching available numbers:", error)
      throw error
    }
  }, [apiUrl])

  return {
    initiateTelnyxCall,
    hangupTelnyxCall,
    configureWebhook,
    getAvailableNumbers,
  }
}
