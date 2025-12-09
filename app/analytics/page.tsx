"use client"

import { useEffect, useState } from "react"
import { Navigation } from "@/components/navigation"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts"
import { RefreshCw, TrendingUp, TrendingDown, Phone, Clock } from "lucide-react"
import { useApiConfig } from "@/hooks/use-api-config"

const DEMO_SUMMARY = {
  total_calls: 47,
  completed: 32,
  failed: 8,
  busy: 5,
  no_answer: 2,
  average_duration: 156,
  success_rate: 68.09,
}

const DEMO_DAILY = [
  { date: new Date(Date.now() - 604800000).toISOString().split("T")[0], total: 5, completed: 3, failed: 1 },
  { date: new Date(Date.now() - 518400000).toISOString().split("T")[0], total: 8, completed: 6, failed: 1 },
  { date: new Date(Date.now() - 432000000).toISOString().split("T")[0], total: 6, completed: 5, failed: 0 },
  { date: new Date(Date.now() - 345600000).toISOString().split("T")[0], total: 9, completed: 7, failed: 2 },
  { date: new Date(Date.now() - 259200000).toISOString().split("T")[0], total: 7, completed: 5, failed: 1 },
  { date: new Date(Date.now() - 172800000).toISOString().split("T")[0], total: 6, completed: 4, failed: 2 },
  { date: new Date(Date.now() - 86400000).toISOString().split("T")[0], total: 6, completed: 2, failed: 1 },
]

const DEMO_TOP_CONTACTS = [
  { _id: "+12125551001", count: 8 },
  { _id: "+12125551002", count: 6 },
  { _id: "+12125551003", count: 5 },
  { _id: "+12125551004", count: 4 },
  { _id: "+12125551005", count: 3 },
]

const DEMO_PATTERNS = [
  { hour: "0", calls: 2 },
  { hour: "1", calls: 1 },
  { hour: "2", calls: 0 },
  { hour: "3", calls: 0 },
  { hour: "4", calls: 0 },
  { hour: "5", calls: 0 },
  { hour: "6", calls: 1 },
  { hour: "7", calls: 3 },
  { hour: "8", calls: 5 },
  { hour: "9", calls: 7 },
  { hour: "10", calls: 6 },
  { hour: "11", calls: 4 },
  { hour: "12", calls: 3 },
  { hour: "13", calls: 5 },
  { hour: "14", calls: 6 },
  { hour: "15", calls: 4 },
  { hour: "16", calls: 3 },
  { hour: "17", calls: 2 },
  { hour: "18", calls: 1 },
  { hour: "19", calls: 0 },
  { hour: "20", calls: 1 },
  { hour: "21", calls: 0 },
  { hour: "22", calls: 0 },
  { hour: "23", calls: 0 },
]

const DEMO_DISPOSITION = {
  completed: 32,
  failed: 8,
  busy: 5,
  no_answer: 2,
  voicemail: 0,
  call_back: 0,
}

interface Summary {
  total_calls: number
  completed: number
  failed: number
  busy: number
  no_answer: number
  average_duration: number
  success_rate: number
}

export default function AnalyticsPage() {
  const { apiUrl } = useApiConfig()
  const [summary, setSummary] = useState<Summary>(DEMO_SUMMARY)
  const [dailyData, setDailyData] = useState(DEMO_DAILY)
  const [topContacts, setTopContacts] = useState(DEMO_TOP_CONTACTS)
  const [patterns, setPatterns] = useState(DEMO_PATTERNS)
  const [disposition, setDisposition] = useState(DEMO_DISPOSITION)
  const [loading, setLoading] = useState(true)
  const [useDemo, setUseDemo] = useState(false)
  const [timeRange, setTimeRange] = useState("7")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())

  // Initial load via REST - FIXED TYPE ERRORS
  const fetchAnalytics = async () => {
    try {
      setLoading(true)

      const [summaryRes, dailyRes, topRes, patternsRes, dispositionRes] = await Promise.all([
        fetch(`${apiUrl}/api/analytics/summary`).catch(() => null),
        fetch(`${apiUrl}/api/analytics/daily?days=${timeRange}`).catch(() => null),
        fetch(`${apiUrl}/api/analytics/top-contacts`).catch(() => null),
        fetch(`${apiUrl}/api/analytics/call-patterns`).catch(() => null),
        fetch(`${apiUrl}/api/analytics/disposition-breakdown`).catch(() => null),
      ])

      let hasData = false

      if (summaryRes && summaryRes.ok) {
        const data = await summaryRes.json()
        setSummary(data)
        hasData = true
      }
      if (dailyRes && dailyRes.ok) {
        const data = await dailyRes.json()
        setDailyData(data)
        hasData = true
      }
      if (topRes && topRes.ok) {
        const data = await topRes.json()
        setTopContacts(data.top_contacts || data)
        hasData = true
      }
      if (patternsRes && patternsRes.ok) {
        const data = await patternsRes.json()
        setPatterns(data.patterns || data)
        hasData = true
      }
      if (dispositionRes && dispositionRes.ok) {
        const data = await dispositionRes.json()
        setDisposition(data)
        hasData = true
      }

      setUseDemo(!hasData)
      setLastUpdated(new Date())
    } catch (error) {
      console.log("Using demo analytics:", error)
      setUseDemo(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [timeRange])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchAnalytics()
    setTimeout(() => setIsRefreshing(false), 500)
  }

  // Real-time updates via WebSocket
  useEffect(() => {
    if (useDemo) return

    const wsUrl = apiUrl.replace("https://", "wss://").replace("http://", "ws://") + "/ws/analytics"

    let ws: WebSocket | null = null
    try {
      ws = new WebSocket(wsUrl)
    } catch (e) {
      console.log("Analytics WebSocket connection failed:", e)
      return
    }

    ws.onopen = () => {
      console.log("📊 Analytics WebSocket connected")
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)

        if (msg.type !== "analytics_update") return

        console.log("📊 Analytics update received:", msg)

        if (msg.summary_delta) {
          setSummary((prev) => {
            const total_calls = prev.total_calls + (msg.summary_delta.total_calls ?? 0)
            const completed = prev.completed + (msg.summary_delta.completed ?? 0)
            const failed = prev.failed + (msg.summary_delta.failed ?? 0)
            const busy = prev.busy + (msg.summary_delta.busy ?? 0)
            const no_answer = prev.no_answer + (msg.summary_delta.no_answer ?? 0)

            return {
              ...prev,
              total_calls,
              completed,
              failed,
              busy,
              no_answer,
              success_rate: total_calls > 0 ? (completed / total_calls) * 100 : 0,
            }
          })
        }

        if (msg.daily_delta) {
          setDailyData((prev) => {
            const { date, total = 0, completed = 0, failed = 0 } = msg.daily_delta
            const idx = prev.findIndex((d) => d.date === date)
            if (idx === -1) {
              return [...prev, { date, total, completed, failed }].sort((a, b) => 
                new Date(a.date).getTime() - new Date(b.date).getTime()
              )
            }
            const copy = [...prev]
            copy[idx] = {
              ...copy[idx],
              total: copy[idx].total + total,
              completed: copy[idx].completed + completed,
              failed: copy[idx].failed + failed,
            }
            return copy
          })
        }

        if (msg.pattern_delta) {
          setPatterns((prev) =>
            prev.map((p) =>
              p.hour === msg.pattern_delta.hour
                ? { ...p, calls: p.calls + (msg.pattern_delta.calls ?? 0) }
                : p
            )
          )
        }

        if (msg.disposition_delta) {
          setDisposition((prev) => ({
            ...prev,
            completed: prev.completed + (msg.disposition_delta.completed ?? 0),
            failed: prev.failed + (msg.disposition_delta.failed ?? 0),
            busy: prev.busy + (msg.disposition_delta.busy ?? 0),
            no_answer: prev.no_answer + (msg.disposition_delta.no_answer ?? 0),
          }))
        }

        setLastUpdated(new Date())
      } catch (e) {
        console.error("Error handling analytics WS message:", e)
      }
    }

    ws.onerror = (e) => {
      console.log("Analytics WebSocket error:", e)
    }

    ws.onclose = () => {
      console.log("Analytics WebSocket disconnected")
    }

    return () => {
      ws?.close()
    }
  }, [apiUrl, useDemo])

  const dispositionData = [
    { name: "Completed", value: disposition.completed, color: "#10b981" },
    { name: "Failed", value: disposition.failed, color: "#ef4444" },
    { name: "Busy", value: disposition.busy, color: "#f59e0b" },
    { name: "No Answer", value: disposition.no_answer, color: "#3b82f6" },
  ].filter(item => item.value > 0)

  const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6"]

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const calculateTrend = () => {
    if (dailyData.length < 2) return 0
    const lastDay = dailyData[dailyData.length - 1]?.total || 0
    const prevDay = dailyData[dailyData.length - 2]?.total || 0
    if (prevDay === 0) return 0
    return ((lastDay - prevDay) / prevDay) * 100
  }

  const trend = calculateTrend()

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        {/* Header - FIXED: Added aria-label to select and button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              aria-label="Select time range for analytics"
              title="Select time range"
              className="flex-1 sm:flex-initial px-4 py-2 bg-input border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
              <option value="90">Last 90 Days</option>
            </select>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              aria-label="Refresh analytics data"
              title="Refresh analytics"
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {useDemo && (
          <div className="mb-6 p-4 bg-ring/10 border border-ring rounded-lg text-sm">
            <p className="font-medium text-ring">
              📊 Demo Mode - Showing sample analytics data. Connect to your backend to see real-time insights.
            </p>
          </div>
        )}

        {loading && !summary ? (
          <div className="mb-4 p-8 text-center">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
            <p className="text-muted-foreground">Loading analytics...</p>
          </div>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <div className="bg-card rounded-lg border border-border p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Total Calls</p>
                  <Phone className="w-5 h-5 text-accent" />
                </div>
                <p className="text-4xl font-bold text-accent mb-1">{summary.total_calls}</p>
                {trend !== 0 && (
                  <div className={`flex items-center gap-1 text-xs ${trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    <span>{Math.abs(trend).toFixed(1)}% vs yesterday</span>
                  </div>
                )}
              </div>
              <div className="bg-card rounded-lg border border-border p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <p className="text-4xl font-bold text-green-500 mb-1">
                  {summary.success_rate.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {summary.completed} of {summary.total_calls} calls
                </p>
              </div>
              <div className="bg-card rounded-lg border border-border p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Avg Duration</p>
                  <Clock className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-4xl font-bold text-blue-500 mb-1">
                  {Math.floor(summary.average_duration / 60)}:{(summary.average_duration % 60).toString().padStart(2, '0')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {summary.average_duration} seconds
                </p>
              </div>
              <div className="bg-card rounded-lg border border-border p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <div className="w-5 h-5 rounded-full bg-green-500/20 flex items-center justify-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
                  </div>
                </div>
                <p className="text-4xl font-bold text-cyan-500 mb-1">{summary.completed}</p>
                <p className="text-xs text-muted-foreground">
                  {summary.failed} failed calls
                </p>
              </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Daily Call Trend */}
              <div className="bg-card rounded-lg border border-border p-6">
                <h2 className="text-lg font-bold mb-4">Daily Call Volume</h2>
                {dailyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={dailyData}>
                      <defs>
                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#888"
                        tickFormatter={formatDate}
                      />
                      <YAxis stroke="#888" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1a1a1a', 
                          border: '1px solid #333',
                          borderRadius: '8px'
                        }}
                        labelFormatter={(value) => formatDate(value as string)}
                      />
                      <Area
                        type="monotone"
                        dataKey="total"
                        stroke="#3b82f6"
                        fillOpacity={1}
                        fill="url(#colorTotal)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </div>

              {/* Call Disposition Pie Chart - FIXED: Added null check for percent */}
              <div className="bg-card rounded-lg border border-border p-6">
                <h2 className="text-lg font-bold mb-4">Call Disposition</h2>
                {dispositionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={dispositionData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, value, percent }) => 
                          `${name}: ${value} (${percent ? (percent * 100).toFixed(0) : 0}%)`
                        }
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {dispositionData.map((entry, index) => (
                          <Cell key={`cell-${entry.name}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1a1a1a', 
                          border: '1px solid #333',
                          borderRadius: '8px'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No disposition data
                  </div>
                )}
              </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Completed vs Failed */}
              <div className="bg-card rounded-lg border border-border p-6">
                <h2 className="text-lg font-bold mb-4">Success vs Failure Trend</h2>
                {dailyData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={dailyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis 
                        dataKey="date" 
                        stroke="#888"
                        tickFormatter={formatDate}
                      />
                      <YAxis stroke="#888" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1a1a1a', 
                          border: '1px solid #333',
                          borderRadius: '8px'
                        }}
                        labelFormatter={(value) => formatDate(value as string)}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="completed"
                        stroke="#10b981"
                        strokeWidth={2}
                        name="Completed"
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="failed"
                        stroke="#ef4444"
                        strokeWidth={2}
                        name="Failed"
                        dot={{ r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No trend data
                  </div>
                )}
              </div>

              {/* Call Patterns by Hour */}
              <div className="bg-card rounded-lg border border-border p-6">
                <h2 className="text-lg font-bold mb-4">Call Patterns (By Hour)</h2>
                {patterns.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={patterns}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="hour" stroke="#888" />
                      <YAxis stroke="#888" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1a1a1a', 
                          border: '1px solid #333',
                          borderRadius: '8px'
                        }}
                        labelFormatter={(value) => `${value}:00`}
                      />
                      <Bar dataKey="calls" fill="#8b5cf6" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No pattern data
                  </div>
                )}
              </div>
            </div>

            {/* Tables Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Top Contacts */}
              <div className="bg-card rounded-lg border border-border overflow-hidden">
                <div className="p-4 border-b border-border">
                  <h2 className="font-bold">Top 10 Contacts</h2>
                </div>
                {topContacts.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-input border-b border-border">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Rank</th>
                          <th className="px-4 py-3 text-left font-semibold">Phone Number</th>
                          <th className="px-4 py-3 text-right font-semibold">Calls</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topContacts.map((contact, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-border hover:bg-input/50 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold">
                                {idx + 1}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono">{contact._id}</td>
                            <td className="px-4 py-3 text-right">
                              <span className="bg-accent text-accent-foreground px-2 py-1 rounded text-xs font-bold">
                                {contact.count}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    No contact data available
                  </div>
                )}
              </div>

              {/* Call Disposition Summary */}
              <div className="bg-card rounded-lg border border-border p-6">
                <h2 className="font-bold mb-4">Disposition Breakdown</h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-input rounded hover:bg-input/80 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-sm font-medium">Completed</span>
                    </div>
                    <span className="font-bold text-green-500">{summary.completed}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-input rounded hover:bg-input/80 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-destructive"></div>
                      <span className="text-sm font-medium">Failed</span>
                    </div>
                    <span className="font-bold text-destructive">{summary.failed}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-input rounded hover:bg-input/80 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                      <span className="text-sm font-medium">Busy</span>
                    </div>
                    <span className="font-bold text-yellow-500">{summary.busy}</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-input rounded hover:bg-input/80 transition-colors">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-ring"></div>
                      <span className="text-sm font-medium">No Answer</span>
                    </div>
                    <span className="font-bold text-ring">{summary.no_answer}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}
