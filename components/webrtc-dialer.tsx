"use client"

import React from "react"

import { useState } from "react"
import { Phone, PhoneOff } from "lucide-react"
import { useWebRTC } from "@/hooks/use-webrtc"

interface WebRTCDialerProps {
  contacts: Array<{ phone: string; name: string }>
  onCallStateChange?: (callState: any) => void
  demoMode?: boolean
  apiUrl?: string
}

export function WebRTCDialer({
  contacts,
  onCallStateChange,
  demoMode = true,
  apiUrl = "http://localhost:8000",
}: WebRTCDialerProps) {
  const [dialedNumber, setDialedNumber] = useState("")
  const [fromNumber, setFromNumber] = useState("+12125551234")

  const { callState, isConnecting, initiateCall, clearCall } = useWebRTC({
    apiUrl,
    demoMode,
  })

  React.useEffect(() => {
    onCallStateChange?.(callState)
  }, [callState, onCallStateChange])

  const dialPad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"]

  const handleDial = (digit: string) => {
    if (dialedNumber.length < 15) {
      setDialedNumber(dialedNumber + digit)
    }
  }

  const handleBackspace = () => {
    setDialedNumber(dialedNumber.slice(0, -1))
  }

  const handleCall = async () => {
    if (!dialedNumber) return
    await initiateCall(dialedNumber, fromNumber)
  }

  const handleContactCall = (contactPhone: string) => {
    setDialedNumber(contactPhone)
  }

  const handleClearCall = () => {
    setDialedNumber("")
    clearCall()
  }

  return (
    <div className="bg-card rounded-lg border border-border p-6 space-y-4">
      <h2 className="text-xl font-bold">WebRTC Dialer</h2>

      {demoMode && (
        <div className="text-xs bg-ring/10 border border-ring rounded p-2 text-ring">
          Demo Mode: Real Telnyx API not connected
        </div>
      )}

      <div className="bg-input rounded-lg p-4 text-center">
        <input
          type="text"
          value={dialedNumber}
          onChange={(e) => setDialedNumber(e.target.value)}
          placeholder="Enter number"
          disabled={
            callState?.status === "active" || callState?.status === "dialing" || callState?.status === "ringing"
          }
          className="w-full bg-transparent text-2xl font-mono font-bold outline-none text-center disabled:opacity-50"
        />
      </div>

      <div>
        <label className="text-sm text-muted-foreground">From</label>
        <select
          value={fromNumber}
          onChange={(e) => setFromNumber(e.target.value)}
          disabled={
            callState?.status === "active" || callState?.status === "dialing" || callState?.status === "ringing"
          }
          className="w-full bg-input border border-border rounded-lg p-2 mt-1 disabled:opacity-50"
        >
          <option value="+12125551234">+1 (212) 555-1234</option>
          <option value="+14155551234">+1 (415) 555-1234</option>
        </select>
      </div>

      {!callState?.status || callState.status === "ended" || callState.status === "error" ? (
        <>
          <div className="grid grid-cols-3 gap-2">
            {dialPad.map((digit) => (
              <button
                key={digit}
                onClick={() => handleDial(digit)}
                disabled={isConnecting}
                className="bg-secondary hover:bg-secondary/80 active:bg-accent active:text-accent-foreground rounded-lg p-4 font-bold text-lg transition-colors disabled:opacity-50"
              >
                {digit}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleBackspace}
              disabled={isConnecting}
              className="flex-1 bg-secondary hover:bg-secondary/80 rounded-lg p-2 text-sm transition-colors disabled:opacity-50"
            >
              ← Backspace
            </button>
            <button
              onClick={() => setDialedNumber("")}
              disabled={isConnecting}
              className="flex-1 bg-secondary hover:bg-secondary/80 rounded-lg p-2 text-sm transition-colors disabled:opacity-50"
            >
              Clear
            </button>
          </div>

          <button
            onClick={handleCall}
            disabled={!dialedNumber || isConnecting}
            className="w-full bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-50 rounded-lg p-3 font-bold flex items-center justify-center gap-2 transition-opacity"
          >
            <Phone className="w-5 h-5" />
            {isConnecting ? "Connecting..." : "Call"}
          </button>
        </>
      ) : (
        <div className="space-y-2">
          <div className="bg-input rounded-lg p-3 text-center">
            <p className="text-sm text-muted-foreground">Call Status</p>
            <p className="text-lg font-bold capitalize">{callState.status}</p>
            {callState.status === "active" && (
              <p className="text-2xl font-mono font-bold text-accent mt-2">
                {String(Math.floor(callState.duration / 60)).padStart(2, "0")}:
                {String(callState.duration % 60).padStart(2, "0")}
              </p>
            )}
          </div>

          <button
            onClick={handleClearCall}
            className="w-full bg-destructive text-destructive-foreground hover:opacity-90 rounded-lg p-3 font-bold flex items-center justify-center gap-2 transition-opacity"
          >
            <PhoneOff className="w-5 h-5" />
            End Call
          </button>
        </div>
      )}

      {contacts.length > 0 && (
        <div className="mt-6 space-y-2">
          <h3 className="text-sm font-semibold">Contacts</h3>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {contacts.slice(0, 5).map((contact) => (
              <button
                key={contact.phone}
                onClick={() => handleContactCall(contact.phone)}
                disabled={
                  callState?.status === "active" || callState?.status === "dialing" || callState?.status === "ringing"
                }
                className="w-full text-left p-2 rounded bg-input hover:bg-secondary transition-colors text-sm disabled:opacity-50"
              >
                <div className="font-medium">{contact.name}</div>
                <div className="text-xs text-muted-foreground">{contact.phone}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
