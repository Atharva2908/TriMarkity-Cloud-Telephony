"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DialerScreen } from "./screens/dialer-screen"
import { ContactsScreen } from "./screens/contacts-screen"
import { CallLogsScreen } from "./screens/call-logs-screen"
import { SettingsScreen } from "./screens/settings-screen"
import { Phone, Users, Clock, Settings } from "lucide-react"

interface SoftphoneLayoutProps {
  contacts: any[]
  demoMode: boolean
}

export function SoftphoneLayout({ contacts, demoMode }: SoftphoneLayoutProps) {
  const [activeTab, setActiveTab] = useState("dialer")
  const [currentCall, setCurrentCall] = useState(null)

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <div className="bg-card/50 backdrop-blur border border-border rounded-2xl overflow-hidden shadow-xl">
              {/* Wrap everything in a single Tabs component */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full grid grid-cols-4 gap-1 p-2 bg-secondary/50 border-b border-border rounded-none">
                  <TabsTrigger
                    value="dialer"
                    className="flex gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg"
                  >
                    <Phone className="w-4 h-4" />
                    <span className="hidden sm:inline">Dialer</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="contacts"
                    className="flex gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg"
                  >
                    <Users className="w-4 h-4" />
                    <span className="hidden sm:inline">Contacts</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="logs"
                    className="flex gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg"
                  >
                    <Clock className="w-4 h-4" />
                    <span className="hidden sm:inline">Logs</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="settings"
                    className="flex gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg"
                  >
                    <Settings className="w-4 h-4" />
                    <span className="hidden sm:inline">Settings</span>
                  </TabsTrigger>
                </TabsList>

                <div className="p-6">
                  <TabsContent value="dialer" className="mt-0">
                    <DialerScreen contacts={contacts} demoMode={demoMode} onCallStateChange={setCurrentCall} />
                  </TabsContent>

                  <TabsContent value="contacts" className="mt-0">
                    <ContactsScreen contacts={contacts} />
                  </TabsContent>

                  <TabsContent value="logs" className="mt-0">
                    <CallLogsScreen />
                  </TabsContent>

                  <TabsContent value="settings" className="mt-0">
                    <SettingsScreen />
                  </TabsContent>
                </div>
              </Tabs>
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
