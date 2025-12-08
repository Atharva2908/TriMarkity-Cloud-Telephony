"use client"

import { useEffect, useState, useCallback, useRef } from "react"

interface WebSocketMessage {
  type: string
  data?: any
}

interface UseWebSocketCallsOptions {
  apiUrl: string
  enabled?: boolean
}

export function useWebSocketCalls({ apiUrl, enabled = true }: UseWebSocketCallsOptions) {
  const [isConnected, setIsConnected] = useState(false)
  const [callUpdates, setCallUpdates] = useState<any[]>([])
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()

  const connect = useCallback(() => {
    if (!enabled) return

    try {
      const wsUrl = apiUrl.replace(/^http/, "ws")
      const ws = new WebSocket(`${wsUrl}/ws/calls`)

      ws.onopen = () => {
        console.log("[v0] WebSocket connected")
        setIsConnected(true)
        // Send initial ping to keep connection alive
        ws.send(JSON.stringify({ type: "ping" }))
      }

      ws.onmessage = (event) => {
        const message: WebSocketMessage = JSON.parse(event.data)
        console.log("[v0] WebSocket message:", message)

        if (message.type === "call_status_update") {
          setCallUpdates((prev) => [...prev.slice(-20), message.data])
        }
      }

      ws.onerror = (error) => {
        console.error("[v0] WebSocket error:", error)
        setIsConnected(false)
      }

      ws.onclose = () => {
        console.log("[v0] WebSocket disconnected")
        setIsConnected(false)
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(connect, 3000)
      }

      wsRef.current = ws

      // Keep connection alive with periodic pings
      const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "ping" }))
        }
      }, 30000)

      return () => clearInterval(pingInterval)
    } catch (error) {
      console.error("[v0] WebSocket connection error:", error)
      setIsConnected(false)
    }
  }, [apiUrl, enabled])

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    setIsConnected(false)
  }, [])

  const broadcast = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  useEffect(() => {
    if (enabled) {
      connect()
    }
    return () => disconnect()
  }, [enabled, connect, disconnect])

  return {
    isConnected,
    callUpdates,
    broadcast,
    disconnect,
  }
}
