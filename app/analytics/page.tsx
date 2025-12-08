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
  const [summary, setSummary] = useState<Summary>(DEMO_SUMMARY)
  const [dailyData, setDailyData] = useState(DEMO_DAILY)
  const [topContacts, setTopContacts] = useState(DEMO_TOP_CONTACTS)
  const [patterns, setPatterns] = useState(DEMO_PATTERNS)
  const [disposition, setDisposition] = useState(DEMO_DISPOSITION)
  const [loading, setLoading] = useState(true)
  const [useDemo, setUseDemo] = useState(true)
  const [timeRange, setTimeRange] = useState("7")

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

  // Initial load via REST
  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true)

        const [summaryRes, dailyRes, topRes, patternsRes, dispositionRes] = await Promise.all([
          fetch(`${apiUrl}/api/analytics/summary`),
          fetch(`${apiUrl}/api/analytics/daily?days=${timeRange}`),
          fetch(`${apiUrl}/api/analytics/top-contacts`),
          fetch(`${apiUrl}/api/analytics/call-patterns`),
          fetch(`${apiUrl}/api/analytics/disposition-breakdown`),
        ])

        if (summaryRes.ok) {
          const data = await summaryRes.json()
          setSummary(data)
        }
        if (dailyRes.ok) {
          const data = await dailyRes.json()
          setDailyData(data)
        }
        if (topRes.ok) {
          const data = await topRes.json()
          setTopContacts(data.top_contacts)
        }
        if (patternsRes.ok) {
          const data = await patternsRes.json()
          setPatterns(data.patterns)
        }
        if (dispositionRes.ok) {
          const data = await dispositionRes.json()
          setDisposition(data)
        }

        setUseDemo(false)
      } catch (error) {
        console.log("Using demo analytics:", error)
        setUseDemo(true)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalytics()
  }, [apiUrl, timeRange])

  // Real-time updates via WebSocket:
  // backend should broadcast messages like:
  // {
  //   "type": "analytics_update",
  //   "summary_delta": {...},
  //   "daily_delta": {...},
  //   "pattern_delta": {...},
  //   "disposition_delta": {...}
  // }
  useEffect(() => {
    const wsUrl =
      apiUrl.replace("https://", "wss://").replace("http://", "ws://") + "/ws/analytics"

    let ws: WebSocket | null = null
    try {
      ws = new WebSocket(wsUrl)
    } catch (e) {
      console.log("Analytics WebSocket connection failed:", e)
      return
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)

        if (msg.type !== "analytics_update") return

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
            if (idx === -1) return prev
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
                : p,
            ),
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
      } catch (e) {
        console.error("Error handling analytics WS message:", e)
      }
    }

    ws.onerror = (e) => {
      console.log("Analytics WebSocket error:", e)
    }

    return () => {
      ws?.close()
    }
  }, [apiUrl])

  const dispositionData = [
    { name: "Completed", value: disposition.completed },
    { name: "Failed", value: disposition.failed },
    { name: "Busy", value: disposition.busy },
    { name: "No Answer", value: disposition.no_answer },
  ]

  const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6"]

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        {useDemo && (
          <div className="mb-6 p-4 bg-ring/10 border border-ring rounded-lg text-sm">
            <p className="font-medium text-ring">Demo Mode - Showing sample analytics</p>
          </div>
        )}

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 bg-input border border-border rounded"
          >
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
          </select>
        </div>

        {loading && (
          <div className="mb-4 text-sm text-muted-foreground">Loading analytics...</div>
        )}

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-card rounded-lg border border-border p-6">
            <p className="text-sm text-muted-foreground mb-2">Total Calls</p>
            <p className="text-4xl font-bold text-accent">{summary.total_calls}</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-6">
            <p className="text-sm text-muted-foreground mb-2">Success Rate</p>
            <p className="text-4xl font-bold text-green-500">
              {summary.success_rate.toFixed(1)}%
            </p>
          </div>
          <div className="bg-card rounded-lg border border-border p-6">
            <p className="text-sm text-muted-foreground mb-2">Avg Duration</p>
            <p className="text-4xl font-bold text-blue-500">
              {summary.average_duration}s
            </p>
          </div>
          <div className="bg-card rounded-lg border border-border p-6">
            <p className="text-sm text-muted-foreground mb-2">Completed</p>
            <p className="text-4xl font-bold text-cyan-500">{summary.completed}</p>
          </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Daily Call Trend */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-lg font-bold mb-4">Daily Call Volume</h2>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dailyData}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorTotal)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Call Disposition Pie Chart */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-lg font-bold mb-4">Call Disposition</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dispositionData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {dispositionData.map((entry, index) => (
                    <Cell
                      key={`cell-${entry.name}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Completed vs Failed */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-lg font-bold mb-4">Success vs Failure Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="completed"
                  stroke="#10b981"
                  strokeWidth={2}
                  name="Completed"
                />
                <Line
                  type="monotone"
                  dataKey="failed"
                  stroke="#ef4444"
                  strokeWidth={2}
                  name="Failed"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Call Patterns by Hour */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="text-lg font-bold mb-4">Call Patterns (By Hour)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={patterns}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="calls" fill="#8b5cf6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tables Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Top Contacts */}
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="font-bold">Top 10 Contacts</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-input border-b border-border">
                  <tr>
                    <th className="px-4 py-2 text-left">Phone Number</th>
                    <th className="px-4 py-2 text-right">Calls</th>
                  </tr>
                </thead>
                <tbody>
                  {topContacts.map((contact, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-border hover:bg-input transition-colors"
                    >
                      <td className="px-4 py-2 font-mono">{contact._id}</td>
                      <td className="px-4 py-2 text-right">
                        <span className="bg-accent text-accent-foreground px-2 py-1 rounded text-xs font-bold">
                          {contact.count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Call Disposition Summary */}
          <div className="bg-card rounded-lg border border-border p-6">
            <h2 className="font-bold mb-4">Disposition Breakdown</h2>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-input rounded">
                <span className="text-sm">Completed</span>
                <span className="font-bold text-green-500">{summary.completed}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-input rounded">
                <span className="text-sm">Failed</span>
                <span className="font-bold text-destructive">{summary.failed}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-input rounded">
                <span className="text-sm">Busy</span>
                <span className="font-bold text-yellow-500">{summary.busy}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-input rounded">
                <span className="text-sm">No Answer</span>
                <span className="font-bold text-ring">{summary.no_answer}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
