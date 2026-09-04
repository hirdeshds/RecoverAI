"use client"
import { useQuery } from '@tanstack/react-query'
import { getAuditLogs } from '@/services/dashboard.api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useState } from 'react'

export default function AuditPage() {
  const [selectedLog, setSelectedLog] = useState<any>(null)
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs-full'],
    queryFn: () => getAuditLogs(200),
    refetchInterval: 15000,
  })

  return (
    <div className="flex-1 space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Audit Logs</h2>
        <p className="text-muted-foreground mt-1">Tamper-evident record of all system actions and AI decisions.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card>
            <CardHeader><CardTitle>Event Log</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity Type</TableHead>
                    <TableHead>Entity ID</TableHead>
                    <TableHead>Actor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center">Loading audit logs...</TableCell></TableRow>
                  ) : logs.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No audit logs yet.</TableCell></TableRow>
                  ) : logs.map((log: any, i: number) => (
                    <TableRow key={i} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedLog(log)}>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{log.entity_type}</TableCell>
                      <TableCell className="text-xs font-mono text-primary">{log.entity_id}</TableCell>
                      <TableCell className="text-xs">{log.actor || 'system'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="sticky top-6">
            <CardHeader><CardTitle>Event Detail</CardTitle></CardHeader>
            <CardContent>
              {selectedLog ? (
                <div className="space-y-2">
                  <pre className="rounded-md bg-muted p-3 text-xs overflow-auto max-h-96 whitespace-pre-wrap">
                    {JSON.stringify(selectedLog, null, 2)}
                  </pre>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Click any log event to view its full metadata.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
