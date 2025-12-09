"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Download, Loader2, RefreshCw, Search, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCallLogs } from "@/hooks/use-call-logs"
import { useApiConfig } from "@/hooks/use-api-config"

export function CallLogsScreen() {
  const { apiUrl } = useApiConfig()
  const { logs, isLoading, error, mutate } = useCallLogs(apiUrl)

  const [filterStatus, setFilterStatus] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [filteredLogs, setFilteredLogs] = useState(logs)
  const [stats, setStats] = useState<any>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch call statistics
  useEffect(() => {
    const loadStats = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/webrtc/stats`)
        if (response.ok) {
          const data = await response.json()
          setStats(data)
        }
      } catch (error) {
        console.error('Failed to load stats:', error)
      }
    }
    
    if (logs && logs.length > 0) {
      loadStats()
    }
  }, [logs, apiUrl])

  // Calculate stats from logs if API doesn't provide them
  useEffect(() => {
    if (logs && logs.length > 0 && !stats) {
      const totalCalls = logs.length
      const completedCalls = logs.filter(log => 
        log.status === 'ended' || log.status === 'completed'
      ).length
      const failedCalls = logs.filter(log => 
        log.status === 'failed' || log.status === 'missed'
      ).length
      
      const totalDuration = logs.reduce((sum, log) => sum + (log.duration || 0), 0)
      const avgDuration = completedCalls > 0 ? Math.floor(totalDuration / completedCalls) : 0

      setStats({
        total_calls: totalCalls,
        completed_calls: completedCalls,
        failed_calls: failedCalls,
        average_duration: avgDuration,
      })
    }
  }, [logs, stats])

  // Filter logs based on status and search query
  useEffect(() => {
    let result = logs || []

    // Filter by status
    if (filterStatus !== "all") {
      result = result.filter((log) => {
        if (filterStatus === 'ended') {
          return log.status === 'ended' || log.status === 'completed'
        }
        return log.status === filterStatus
      })
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter((log) =>
        log.to_number?.toLowerCase().includes(query) ||
        log.from_number?.toLowerCase().includes(query) ||
        log.notes?.toLowerCase().includes(query) ||
        log.call_id?.toLowerCase().includes(query)
      )
    }

    // Sort by date (newest first)
    result = result.sort((a, b) => {
      const dateA = new Date(a.created_at || a.start_time || 0).getTime()
      const dateB = new Date(b.created_at || b.start_time || 0).getTime()
      return dateB - dateA
    })

    setFilteredLogs(result)
  }, [logs, filterStatus, searchQuery])

  const formatDuration = (seconds: number) => {
    if (!seconds || seconds === 0) return "--:--"
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "-"
    try {
      const date = new Date(dateStr)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMs / 3600000)
      const diffDays = Math.floor(diffMs / 86400000)

      // Show relative time for recent calls
      if (diffMins < 1) return "Just now"
      if (diffMins < 60) return `${diffMins}m ago`
      if (diffHours < 24) return `${diffHours}h ago`
      if (diffDays < 7) return `${diffDays}d ago`

      // Show full date for older calls
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "ended":
      case "completed":
        return "text-green-500"
      case "failed":
      case "missed":
        return "text-red-500"
      case "active":
      case "dialing":
      case "ringing":
        return "text-yellow-500"
      default:
        return "text-slate-400"
    }
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case "ended":
      case "completed":
        return "bg-green-500/10 border-green-500/20"
      case "failed":
      case "missed":
        return "bg-red-500/10 border-red-500/20"
      case "active":
      case "dialing":
      case "ringing":
        return "bg-yellow-500/10 border-yellow-500/20"
      default:
        return "bg-slate-500/10 border-slate-500/20"
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await mutate()
      
      // Also refresh stats
      const response = await fetch(`${apiUrl}/api/webrtc/stats`)
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Refresh failed:', error)
    } finally {
      setTimeout(() => setIsRefreshing(false), 500)
    }
  }

  const handleDownloadRecording = async (recordingUrl: string, callId: string) => {
    try {
      const response = await fetch(recordingUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `recording-${callId}.mp3`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Download failed:', error)
      // Fallback to opening in new tab
      window.open(recordingUrl, '_blank')
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Call Logs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View and manage your call history
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
              Total Calls
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-foreground mt-1">
              {stats.total_calls || 0}
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
              Completed
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400 mt-1">
              {stats.completed_calls || 0}
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
              Failed
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-400 mt-1">
              {stats.failed_calls || 0}
            </div>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-accent/10 to-accent/5 border-accent/20">
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">
              Avg Duration
            </div>
            <div className="text-2xl sm:text-3xl font-bold text-accent mt-1">
              {formatDuration(stats.average_duration || 0)}
            </div>
          </Card>
        </div>
      )}

      {/* Search and Refresh */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by number, notes, or call ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button 
          onClick={handleRefresh} 
          variant="outline" 
          size="default" 
          className="sm:w-auto"
          disabled={isRefreshing || isLoading}
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Status Filters */}
      <div className="flex gap-2 flex-wrap">
        {["all", "ended", "active", "failed"].map((status) => (
          <Button
            key={status}
            onClick={() => setFilterStatus(status)}
            variant={filterStatus === status ? "default" : "outline"}
            size="sm"
            className={
              filterStatus === status 
                ? "bg-primary hover:bg-primary/90 text-primary-foreground" 
                : ""
            }
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {filterStatus === status && logs && (
              <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-primary-foreground/20">
                {status === 'all' 
                  ? logs.length 
                  : logs.filter(l => {
                      if (status === 'ended') return l.status === 'ended' || l.status === 'completed'
                      return l.status === status
                    }).length
                }
              </span>
            )}
          </Button>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && !logs && (
        <Card className="p-8 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary" />
          <p className="text-muted-foreground">Loading call logs...</p>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="p-4 bg-destructive/10 border-destructive/20">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-destructive"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-destructive text-sm font-medium">
              Failed to load call logs. Please try refreshing.
            </p>
          </div>
        </Card>
      )}

      {/* Call Logs List */}
      <div className="space-y-2">
        {!isLoading && filteredLogs.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">
              {searchQuery || filterStatus !== "all" 
                ? "No matching call logs found" 
                : "No call logs yet"}
            </p>
            <p className="text-sm mt-1">
              {searchQuery || filterStatus !== "all"
                ? "Try adjusting your filters or search query"
                : "Start making calls to see your history here"}
            </p>
          </Card>
        ) : (
          filteredLogs.map((log) => (
            <Card
              key={log._id || log.call_id}
              className={`p-4 hover:bg-secondary/50 transition-all duration-200 border ${getStatusBadgeColor(
                log.status
              )} hover:shadow-md`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="font-semibold text-foreground text-lg">
                      {log.to_number || "Unknown"}
                    </p>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${getStatusBadgeColor(
                        log.status
                      )} ${getStatusColor(log.status)}`}
                    >
                      {log.status?.toUpperCase() || 'UNKNOWN'}
                    </span>
                    {log.recording_url && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-500">
                        RECORDED
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    From: <span className="font-mono">{log.from_number || "Unknown"}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(log.created_at || log.start_time)}
                  </p>
                  {log.call_id && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ID: <span className="font-mono">{log.call_id}</span>
                    </p>
                  )}
                  {log.notes && (
                    <div className="mt-2 p-2 bg-secondary/50 rounded border border-border">
                      <p className="text-xs text-muted-foreground flex items-start gap-2">
                        <FileText className="w-3 h-3 mt-0.5 flex-shrink-0" />
                        <span className="flex-1">{log.notes}</span>
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold text-foreground">
                      {formatDuration(log.duration)}
                    </p>
                    <p className="text-xs text-muted-foreground">duration</p>
                  </div>
                  {log.recording_url && (
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="hover:bg-primary/10 hover:text-primary"
                      onClick={() => handleDownloadRecording(log.recording_url, log.call_id)}
                      title="Download recording"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Results Count */}
      {!isLoading && filteredLogs.length > 0 && (
        <div className="text-center py-2">
          <p className="text-xs text-muted-foreground">
            Showing <span className="font-semibold text-foreground">{filteredLogs.length}</span> of{" "}
            <span className="font-semibold text-foreground">{logs?.length || 0}</span>{" "}
            {logs?.length === 1 ? "call" : "calls"}
          </p>
        </div>
      )}
    </div>
  )
}
