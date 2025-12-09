"use client"

import { useState } from "react"
import { DialerScreen } from "./screens/dialer-screen"
import { Phone } from "lucide-react"

interface SoftphoneLayoutProps {
  contacts: any[]
  demoMode: boolean
}

export function SoftphoneLayout({ contacts, demoMode }: SoftphoneLayoutProps) {
  const [currentCall, setCurrentCall] = useState(null)

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <div className="bg-card/50 backdrop-blur border border-border rounded-2xl overflow-hidden shadow-xl">
              {/* Simple header instead of tabs */}
              <div className="w-full p-4 bg-secondary/50 border-b border-border">
                <div className="flex items-center gap-2 text-primary font-semibold">
                  <Phone className="w-5 h-5" />
                  <span>Dialer</span>
                </div>
              </div>

              <div className="p-6">
                <DialerScreen 
                  contacts={contacts} 
                  demoMode={demoMode} 
                  onCallStateChange={setCurrentCall} 
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            {currentCall ? (
              <div className="sticky top-24 bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5 border border-primary/20 rounded-2xl p-6 backdrop-blur space-y-6 shadow-xl">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Current Call
                  </p>
                  <p className="text-lg font-bold text-foreground">{currentCall.to_number}</p>
                  <p className="text-xs text-muted-foreground mt-1">From: {currentCall.from_number}</p>
                </div>

                {currentCall.status === "active" && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Duration</p>
                    <p className="text-4xl font-mono font-bold text-accent">
                      {String(Math.floor(currentCall.duration / 60)).padStart(2, "0")}:
                      {String(currentCall.duration % 60).padStart(2, "0")}
                    </p>
                  </div>
                )}

                <div>
                  <span
                    className={`inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-full ${
                      currentCall.status === "active"
                        ? "bg-green-500/20 text-green-600 dark:text-green-400"
                        : "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full mr-2 ${currentCall.status === "active" ? "bg-green-500" : "bg-blue-500"} animate-pulse`}
                    ></span>
                    {currentCall.status === "active" ? "Connected" : "Connecting"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="sticky top-24 bg-gradient-to-br from-secondary to-secondary/50 border border-border rounded-2xl p-6 backdrop-blur text-center space-y-4">
                <div className="flex justify-center">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <Phone className="w-6 h-6 text-primary" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">No Active Call</p>
                  <p className="text-xs text-muted-foreground mt-1">Call status will appear here</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
