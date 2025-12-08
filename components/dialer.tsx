"use client"

import { useState } from "react"
import { Phone } from "lucide-react"

interface Contact {
  phone: string
  name: string
}

interface DialerProps {
  onCall: (toNumber: string, fromNumber: string) => void
  contacts: Contact[]
}

export function Dialer({ onCall, contacts }: DialerProps) {
  const [dialedNumber, setDialedNumber] = useState("")
  const [fromNumber, setFromNumber] = useState("+12125551234")
  const [isCalling, setIsCalling] = useState(false)

  const dialPad = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"]

  const handleDial = (digit: string) => {
    if (dialedNumber.length < 15) {
      setDialedNumber(dialedNumber + digit)
    }
  }

  const handleBackspace = () => {
    setDialedNumber(dialedNumber.slice(0, -1))
  }

  const handleCall = () => {
    if (!dialedNumber) return
    setIsCalling(true)
    onCall(dialedNumber, fromNumber)
  }

  const handleContactCall = (contactPhone: string) => {
    setDialedNumber(contactPhone)
  }

  return (
    <div className="bg-card rounded-lg border border-border p-6 space-y-4">
      <h2 className="text-xl font-bold">Dialer</h2>

      <div className="bg-input rounded-lg p-4 text-center">
        <input
          type="text"
          value={dialedNumber}
          onChange={(e) => setDialedNumber(e.target.value)}
          placeholder="Enter number"
          className="w-full bg-transparent text-2xl font-mono font-bold outline-none text-center"
        />
      </div>

      <div>
        <label className="text-sm text-muted-foreground">From</label>
        <select
          value={fromNumber}
          onChange={(e) => setFromNumber(e.target.value)}
          className="w-full bg-input border border-border rounded-lg p-2 mt-1"
        >
          <option value="+12125551234">+1 (212) 555-1234</option>
          <option value="+14155551234">+1 (415) 555-1234</option>
        </select>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {dialPad.map((digit) => (
          <button
            key={digit}
            onClick={() => handleDial(digit)}
            className="bg-secondary hover:bg-secondary/80 active:bg-accent active:text-accent-foreground rounded-lg p-4 font-bold text-lg transition-colors"
          >
            {digit}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleBackspace}
          className="flex-1 bg-secondary hover:bg-secondary/80 rounded-lg p-2 text-sm transition-colors"
        >
          ← Backspace
        </button>
        <button
          onClick={() => setDialedNumber("")}
          className="flex-1 bg-secondary hover:bg-secondary/80 rounded-lg p-2 text-sm transition-colors"
        >
          Clear
        </button>
      </div>

      <button
        onClick={handleCall}
        disabled={!dialedNumber || isCalling}
        className="w-full bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-50 rounded-lg p-3 font-bold flex items-center justify-center gap-2 transition-opacity"
      >
        <Phone className="w-5 h-5" />
        Call
      </button>

      {contacts.length > 0 && (
        <div className="mt-6 space-y-2">
          <h3 className="text-sm font-semibold">Recent Contacts</h3>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {contacts.slice(0, 5).map((contact) => (
              <button
                key={contact.phone}
                onClick={() => handleContactCall(contact.phone)}
                className="w-full text-left p-2 rounded bg-input hover:bg-secondary transition-colors text-sm"
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
