"use client"

import { useEffect, useRef, useCallback } from "react"

interface WebhookListener {
  onCallUpdate: (callData: any) => void
  onError?: (error: string) => void
}

export function useWebhookCalls(apiUrl = "http://localhost:8000") {
  const wsRef = useRef<WebSocket | null>(null)
  const listenersRef = useRef<Set<WebhookListener>>(new Set())
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const hasLoggedErrorRef = useRef(false)

  const connectWebSocket = useCallback(() => {
    try {
      const wsUrl = apiUrl.replace("http", "ws") + "/ws/calls"
      wsRef.current = new WebSocket(wsUrl)

      wsRef.current.onopen = () => {
        console.log("[v0] WebSocket connected for real-time call updates")
        hasLoggedErrorRef.current = false
      }

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          listenersRef.current.forEach((listener) => {
            listener.onCallUpdate(message)
          })
        } catch (error) {
          console.error("[v0] Error parsing WebSocket message:", error)
        }
      }

      wsRef.current.onerror = () => {
        if (!hasLoggedErrorRef.current) {
          console.log("[v0] WebSocket not available - using polling instead")
          hasLoggedErrorRef.current = true
        }
      }

      wsRef.current.onclose = () => {
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000)
      }
    } catch (error) {
      // Silent fail - WebSocket might not be available in demo mode
      if (!hasLoggedErrorRef.current) {
        console.log("[v0] WebSocket unavailable - app will use polling for call status")
        hasLoggedErrorRef.current = true
      }
    }
  }, [apiUrl])

  const subscribe = useCallback(
    (listener: WebhookListener) => {
      listenersRef.current.add(listener)

      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connectWebSocket()
      }

      return () => {
        listenersRef.current.delete(listener)
      }
    },
    [connectWebSocket],
  )

  const sendPing = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "ping" }))
    }
  }, [])

  useEffect(() => {
    connectWebSocket()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [connectWebSocket])

  return {
    subscribe,
    sendPing,
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
  }
}
