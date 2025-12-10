"use client"

import { useEffect, useState, useRef } from "react"
import { Navigation } from "@/components/navigation"
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend
} from "recharts"
import { 
  Trash2, 
  Download, 
  RefreshCw, 
  CheckSquare, 
  Square,
  Search,
  FileDown,
} from "lucide-react"
import { useApiConfig } from "@/hooks/use-api-config"

const DEMO_LOGS = [
  {
    _id: "1",
    call_id: "call-001",
    from_number: "+12125551234",
    to_number: "+12125551001",
    duration: 245,
    status: "ended",
    disposition: "completed",
    recording_url: "https://example.com/recording1.wav",
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    _id: "2",
    call_id: "call-002",
    from_number: "+12125551234",
    to_number: "+12125551002",
    duration: 0,
    status: "ended",
    disposition: "no_answer",
    created_at: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    _id: "3",
    call_id: "call-003",
    from_number: "+12125551234",
    to_number: "+12125551003",
    duration: 180,
    status: "ended",
    disposition: "completed",
    recording_url: "https://example.com/recording3.wav",
    created_at: new Date().toISOString(),
  },
  {
    _id: "4",
    call_id: "call-004",
    from_number: "+12125551234",
    to_number: "+12125551004",
    duration: 0,
    status: "ended",
    disposition: "busy",
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
]

interface CallLog {
  _id: string
  call_id: string
  from_number: string
  to_number: string
  duration: number
  status: string
  disposition?: string
  recording_url?: string
  created_at: string
}

export default function CallLogsPage() {
  const { apiUrl } = useApiConfig()
  const [logs, setLogs] = useState<CallLog[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ 
    total: 0, 
    completed: 0, 
    failed: 0, 
    busy: 0, 
    noAnswer: 0,
    totalDuration: 0,
    avgDuration: 0
  })
  const [useDemo, setUseDemo] = useState(false)
  const [filterDisposition, setFilterDisposition] = useState<string>("all")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [dateFilter, setDateFilter] = useState<string>("all")
  const [wsConnected, setWsConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  // WebSocket for real-time updates
  useEffect(() => {
    if (useDemo) return

    const connectWebSocket = () => {
      const wsUrl = apiUrl.replace('http://', 'ws://').replace('https://', 'wss://')
      const ws = new WebSocket(`${wsUrl}/ws/calls`)

      ws.onopen = () => {
        console.log('📡 [CallLogs] WebSocket connected')
        setWsConnected(true)
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          console.log('📨 [CallLogs] Message:', data.type)

          // Refresh logs when call ends or is updated
          if (data.type === 'call_ended' || data.type === 'log_updated') {
            fetchCallLogs()
          }

          // Handle log deletion
          if (data.type === 'log_deleted') {
            setLogs(prev => prev.filter(log => log.call_id !== data.call_id))
          }
        } catch (err) {
          console.error('WebSocket error:', err)
        }
      }

      ws.onerror = () => setWsConnected(false)
      ws.onclose = () => {
        setWsConnected(false)
        setTimeout(connectWebSocket, 3000)
      }

      wsRef.current = ws
    }

    connectWebSocket()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [apiUrl, useDemo])

  useEffect(() => {
    fetchCallLogs()
  }, [])

  const fetchCallLogs = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${apiUrl}/api/webrtc/logs`)

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json()
      const callLogs = data.logs || data || []
      
      // Sort by date descending
      const sortedLogs = callLogs.sort((a: CallLog, b: CallLog) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )
      
      setLogs(sortedLogs)
      setUseDemo(false)
      calculateStats(sortedLogs)
    } catch (error) {
      console.log("Using demo logs:", error)
      setLogs(DEMO_LOGS)
      setUseDemo(true)
      calculateStats(DEMO_LOGS)
    } finally {
      setLoading(false)
    }
  }

  const calculateStats = (callLogs: CallLog[]) => {
    const completed = callLogs.filter((log) => 
      log.disposition === "completed" || log.status === "ended"
    ).length
    const failed = callLogs.filter((log) => log.disposition === "failed").length
    const busy = callLogs.filter((log) => log.disposition === "busy").length
    const noAnswer = callLogs.filter((log) => log.disposition === "no_answer").length
    
    const totalDuration = callLogs.reduce((sum, log) => sum + (log.duration || 0), 0)
    const avgDuration = completed > 0 ? Math.floor(totalDuration / completed) : 0

    setStats({
      total: callLogs.length,
      completed,
      failed,
      busy,
      noAnswer,
      totalDuration,
      avgDuration
    })
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchCallLogs()
    setSelectedIds(new Set())
    setTimeout(() => setIsRefreshing(false), 500)
  }

  const deleteLog = async (logId: string) => {
    if (!confirm("Are you sure you want to delete this call log?")) return

    try {
      const response = await fetch(`${apiUrl}/api/webrtc/logs/${logId}`, {
        method: "DELETE",
      })

      if (response.ok || useDemo) {
        const updatedLogs = logs.filter((log) => log._id !== logId)
        setLogs(updatedLogs)
        calculateStats(updatedLogs)
        setSelectedIds(prev => {
          const next = new Set(prev)
          next.delete(logId)
          return next
        })
      }
    } catch (error) {
      console.error("Error deleting log:", error)
      const updatedLogs = logs.filter((log) => log._id !== logId)
      setLogs(updatedLogs)
      calculateStats(updatedLogs)
    }
  }

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Delete ${selectedIds.size} selected call logs?`)) return

    const idsToDelete = Array.from(selectedIds)
    
    try {
      await Promise.all(
        idsToDelete.map(id => 
          fetch(`${apiUrl}/api/webrtc/logs/${id}`, { method: "DELETE" })
        )
      )
      
      const updatedLogs = logs.filter(log => !selectedIds.has(log._id))
      setLogs(updatedLogs)
      calculateStats(updatedLogs)
      setSelectedIds(new Set())
    } catch (error) {
      console.error("Error bulk deleting:", error)
      const updatedLogs = logs.filter(log => !selectedIds.has(log._id))
      setLogs(updatedLogs)
      calculateStats(updatedLogs)
      setSelectedIds(new Set())
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLogs.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredLogs.map(log => log._id)))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const exportToCSV = () => {
    const dataToExport = selectedIds.size > 0 
      ? logs.filter(log => selectedIds.has(log._id))
      : filteredLogs

    const headers = ["Call ID", "From", "To", "Duration", "Disposition", "Date"]
    const rows = dataToExport.map(log => [
      log.call_id,
      log.from_number,
      log.to_number,
      formatDuration(log.duration),
      log.disposition || "N/A",
      new Date(log.created_at).toLocaleString()
    ])

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `call-logs-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredLogs = logs.filter(log => {
    if (filterDisposition !== "all" && log.disposition !== filterDisposition) {
      return false
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      const matchesSearch = 
        log.to_number?.toLowerCase().includes(query) ||
        log.from_number?.toLowerCase().includes(query) ||
        log.call_id?.toLowerCase().includes(query)
      
      if (!matchesSearch) return false
    }

    if (dateFilter !== "all") {
      const logDate = new Date(log.created_at)
      const now = new Date()
      
      if (dateFilter === "today") {
        if (logDate.toDateString() !== now.toDateString()) return false
      } else if (dateFilter === "week") {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        if (logDate < weekAgo) return false
      } else if (dateFilter === "month") {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        if (logDate < monthAgo) return false
      }
    }

    return true
  })

  const dispositionData = [
    { name: "Completed", value: stats.completed, color: "#10b981" },
    { name: "Failed", value: stats.failed, color: "#ef4444" },
    { name: "Busy", value: stats.busy, color: "#f59e0b" },
    { name: "No Answer", value: stats.noAnswer, color: "#3b82f6" },
  ].filter(item => item.value > 0)

  const getDurationTrendData = () => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - i))
      return date.toISOString().split('T')[0]
    })

    return last7Days.map(date => {
      const dayLogs = logs.filter(log => 
        log.created_at?.split('T')[0] === date
      )
      const totalDuration = dayLogs.reduce((sum, log) => sum + (log.duration || 0), 0)
      return {
        date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        duration: Math.floor(totalDuration / 60),
        calls: dayLogs.length
      }
    })
  }

  const durationTrendData = getDurationTrendData()

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        {/* Header with refresh */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Call Logs & Analytics</h1>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
              <span>Track and analyze your call performance</span>
              {!useDemo && (
                <span className={`inline-flex items-center gap-1 text-xs ${wsConnected ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-green-600 animate-pulse' : 'bg-amber-600'}`} />
                  {wsConnected ? 'Live' : 'Offline'}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-input transition-colors"
              title="Export to CSV"
            >
              <FileDown className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {useDemo && (
          <div className="mb-6 p-4 bg-ring/10 border border-ring rounded-lg text-sm">
            <p className="font-medium text-ring">
              📊 Demo Mode - Showing sample data. Connect to your backend to see real call logs.
            </p>
          </div>
        )}

        {/* Stats Cards - Fixed Layout */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <div className="bg-card rounded-lg border border-border p-4 hover:shadow-lg transition-shadow">
            <p className="text-xs text-muted-foreground uppercase font-semibold">Total Calls</p>
            <p className="text-2xl font-bold text-foreground mt-1">{stats.total}</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-4 hover:shadow-lg transition-shadow">
            <p className="text-xs text-muted-foreground uppercase font-semibold">Completed</p>
            <p className="text-2xl font-bold text-green-500 mt-1">{stats.completed}</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-4 hover:shadow-lg transition-shadow">
            <p className="text-xs text-muted-foreground uppercase font-semibold">Failed</p>
            <p className="text-2xl font-bold text-destructive mt-1">{stats.failed}</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-4 hover:shadow-lg transition-shadow">
            <p className="text-xs text-muted-foreground uppercase font-semibold">Busy</p>
            <p className="text-2xl font-bold text-yellow-500 mt-1">{stats.busy}</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-4 hover:shadow-lg transition-shadow">
            <p className="text-xs text-muted-foreground uppercase font-semibold">No Answer</p>
            <p className="text-2xl font-bold text-blue-500 mt-1">{stats.noAnswer}</p>
          </div>
          <div className="bg-card rounded-lg border border-border p-4 hover:shadow-lg transition-shadow">
            <p className="text-xs text-muted-foreground uppercase font-semibold">Avg Duration</p>
            <p className="text-2xl font-bold text-primary mt-1">{formatDuration(stats.avgDuration)}</p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Pie Chart */}
          <div className="bg-card rounded-lg border border-border p-6 hover:shadow-lg transition-shadow">
            <h2 className="font-bold text-lg mb-4">Disposition Breakdown</h2>
            {dispositionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={dispositionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) => 
                      `${name}: ${value} (${((percent || 0) * 100).toFixed(0)}%)`
                    }
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {dispositionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </div>

          {/* Bar Chart */}
          <div className="bg-card rounded-lg border border-border p-6 hover:shadow-lg transition-shadow">
            <h2 className="font-bold text-lg mb-4">Call Duration Trend (Last 7 Days)</h2>
            {durationTrendData.some(d => d.calls > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={durationTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="date" stroke="#888" />
                  <YAxis stroke="#888" label={{ value: 'Minutes', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#1a1a1a', 
                      border: '1px solid #333',
                      borderRadius: '8px'
                    }}
                    labelStyle={{ color: '#fff' }}
                  />
                  <Bar dataKey="duration" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No call data for the past 7 days
              </div>
            )}
          </div>
        </div>

        {/* Call Logs Table */}
        <div className="bg-card rounded-lg border border-border overflow-hidden shadow-lg">
          {/* Filters and Search Bar */}
          <div className="p-4 border-b border-border bg-input/30">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by number or call ID..."
                  className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label="Search call logs"
                />
              </div>

              {/* Filters */}
              <div className="flex gap-2 flex-wrap">
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label="Filter by date range"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">Last 7 Days</option>
                  <option value="month">Last 30 Days</option>
                </select>

                <select
                  value={filterDisposition}
                  onChange={(e) => setFilterDisposition(e.target.value)}
                  className="px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  aria-label="Filter by disposition"
                >
                  <option value="all">All Dispositions</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="busy">Busy</option>
                  <option value="no_answer">No Answer</option>
                </select>
              </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
              <div className="mt-4 flex items-center gap-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                <span className="text-sm font-medium">
                  {selectedIds.size} selected
                </span>
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={exportToCSV}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
                  >
                    <FileDown className="w-4 h-4" />
                    Export Selected
                  </button>
                  <button
                    onClick={bulkDelete}
                    className="flex items-center gap-2 px-3 py-1.5 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors text-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Selected
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
              <p className="text-muted-foreground">Loading call logs...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <p className="text-lg font-medium">No call logs found</p>
              <p className="text-sm mt-1">Try adjusting your filters or search query</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-input border-b border-border sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <button
                        onClick={toggleSelectAll}
                        className="hover:bg-background/50 rounded p-1 transition-colors"
                        title={selectedIds.size === filteredLogs.length ? "Deselect all" : "Select all"}
                        aria-label={selectedIds.size === filteredLogs.length ? "Deselect all rows" : "Select all rows"}
                      >
                        {selectedIds.size === filteredLogs.length ? (
                          <CheckSquare className="w-5 h-5 text-primary" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">From</th>
                    <th className="px-4 py-3 text-left font-semibold">To</th>
                    <th className="px-4 py-3 text-left font-semibold">Duration</th>
                    <th className="px-4 py-3 text-left font-semibold">Disposition</th>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log) => (
                    <tr 
                      key={log._id} 
                      className={`border-b border-border hover:bg-input/50 transition-colors ${
                        selectedIds.has(log._id) ? 'bg-primary/5' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleSelect(log._id)}
                          className="hover:bg-background/50 rounded p-1 transition-colors"
                          aria-label={selectedIds.has(log._id) ? "Deselect row" : "Select row"}
                        >
                          {selectedIds.has(log._id) ? (
                            <CheckSquare className="w-5 h-5 text-primary" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{log.from_number}</td>
                      <td className="px-4 py-3 font-mono text-xs">{log.to_number}</td>
                      <td className="px-4 py-3 font-mono">{formatDuration(log.duration)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium inline-block ${
                            log.disposition === "completed"
                              ? "bg-green-500/20 text-green-500"
                              : log.disposition === "failed"
                                ? "bg-destructive/20 text-destructive"
                                : log.disposition === "busy"
                                  ? "bg-yellow-500/20 text-yellow-500"
                                  : "bg-blue-500/20 text-blue-500"
                          }`}
                        >
                          {log.disposition || "N/A"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1 items-center">
                          <button
                            onClick={() => deleteLog(log._id)}
                            className="p-1.5 hover:bg-destructive/10 rounded transition-colors"
                            title="Delete"
                            aria-label="Delete log"
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </button>
                          {log.recording_url && (
                            <a
                              href={log.recording_url}
                              className="p-1.5 hover:bg-input rounded transition-colors"
                              title="Download Recording"
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Download recording"
                            >
                              <Download className="w-4 h-4 text-primary" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Results count */}
          {!loading && filteredLogs.length > 0 && (
            <div className="p-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border bg-input/30">
              <span>
                Showing {filteredLogs.length} of {logs.length} calls
              </span>
              {selectedIds.size > 0 && (
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-primary hover:underline"
                >
                  Clear selection
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
