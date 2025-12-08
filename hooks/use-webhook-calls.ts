"use client"

import { useEffect, useRef, useCallback, useState } from "react"

interface WebhookListener {
  onCallUpdate: (callData: any) => void
  onError?: (error: string) => void
}

export function useWebhookCalls(apiUrl = "http://localhost:8000") {
  const wsRef = useRef<WebSocket | null>(null)
  const listenersRef = useRef<Set<WebhookListener>>(new Set())
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const reconnectAttemptsRef = useRef(0)
  const hasLoggedErrorRef = useRef(false)
  const [isConnected, setIsConnected] = useState(false)

  const notifyListeners = useCallback((callData: any) => {
    listenersRef.current.forEach((listener) => {
      try {
        listener.onCallUpdate(callData)
      } catch (error) {
        console.error("❌ [WebSocket] Listener error:", error)
        listener.onError?.("Failed to process call update")
      }
    })
  }, [])

  const notifyError = useCallback((errorMessage: string) => {
    listenersRef.current.forEach((listener) => {
      listener.onError?.(errorMessage)
    })
  }, [])

  const connectWebSocket = useCallback(() => {
    try {
      // Convert HTTP(S) to WS(S) properly
      const wsUrl = apiUrl.replace(/^https?/, (match) => match === 'https' ? 'wss' : 'ws') + "/ws/calls"
      
      console.log(`[WebSocket] Connecting to: ${wsUrl}`)
      wsRef.current = new WebSocket(wsUrl)

      wsRef.current.onopen = () => {
        console.log("✅ [WebSocket] Connected - Real-time call updates active")
        setIsConnected(true)
        hasLoggedErrorRef.current = false
        reconnectAttemptsRef.current = 0
      }

      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          
          // Handle different message types
          if (message.type === "pong") {
            console.log("🏓 [WebSocket] Pong received")
            return
          }
          
          if (message.type === "call_update" || message.call_id) {
            console.log("📞 [WebSocket] Call update:", message)
            notifyListeners(message)
          }
        } catch (error) {
          console.error("❌ [WebSocket] Error parsing message:", error)
          notifyError("Failed to parse call update")
        }
      }

      wsRef.current.onerror = (error) => {
        if (!hasLoggedErrorRef.current) {
          console.warn("⚠️ [WebSocket] Connection error - Will retry")
          hasLoggedErrorRef.current = true
        }
        setIsConnected(false)
      }

      wsRef.current.onclose = (event) => {
        console.log(`🔌 [WebSocket] Disconnected (Code: ${event.code})`)
        setIsConnected(false)

        // Clear any existing reconnection timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current)
        }

        // Exponential backoff reconnection (1s → 2s → 4s → 8s → 16s → 30s max)
        reconnectAttemptsRef.current++
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000)
        
        console.log(`🔄 [WebSocket] Reconnecting in ${delay / 1000}s (attempt ${reconnectAttemptsRef.current})`)
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket()
        }, delay)
      }
    } catch (error) {
      if (!hasLoggedErrorRef.current) {
        console.error("❌ [WebSocket] Failed to create connection:", error)
        hasLoggedErrorRef.current = true
      }
      setIsConnected(false)
      notifyError("WebSocket connection failed")
    }
  }, [apiUrl, notifyListeners, notifyError])

  const subscribe = useCallback(
    (listener: WebhookListener) => {
      listenersRef.current.add(listener)
      console.log(`[WebSocket] Listener added (Total: ${listenersRef.current.size})`)

      // Connect if not already connected
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        connectWebSocket()
      }

      // Return cleanup function
      return () => {
        listenersRef.current.delete(listener)
        console.log(`[WebSocket] Listener removed (Total: ${listenersRef.current.size})`)
      }
    },
    [connectWebSocket],
  )

  const sendPing = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "ping" }))
      console.log("🏓 [WebSocket] Ping sent")
    } else {
      console.warn("⚠️ [WebSocket] Cannot send ping - Not connected")
    }
  }, [])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (wsRef.current) {
      console.log("🔌 [WebSocket] Manually disconnecting")
      wsRef.current.close()
      wsRef.current = null
    }
    setIsConnected(false)
  }, [])

  const reconnect = useCallback(() => {
    disconnect()
    reconnectAttemptsRef.current = 0
    connectWebSocket()
  }, [disconnect, connectWebSocket])

  useEffect(() => {
    connectWebSocket()

    // Cleanup on unmount
    return () => {
      console.log("🧹 [WebSocket] Component unmounting - Cleaning up")
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        wsRef.current.close()
      }
      listenersRef.current.clear()
    }
  }, [connectWebSocket])

  return {
    subscribe,
    sendPing,
    disconnect,
    reconnect,
    isConnected,
  }
}
