"use client"
import { useQuery } from '@tanstack/react-query'
import { getRiskEvents } from '@/services/misc.api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertTriangle } from 'lucide-react'

const RISK_COLOR: Record<string, any> = {
  PAYMENT_FAILURE: 'destructive',
  CHECKOUT_ABANDONMENT: 'warning',
  SUBSCRIPTION_FAILURE: 'warning',
  OVERDUE_INVOICE: 'destructive',
}

export default function RiskPage() {
  const { data: risks = [], isLoading } = useQuery({
    queryKey: ['risk-events'],
    queryFn: getRiskEvents,
    refetchInterval: 15000,
  })

  const totalAtRisk = risks.reduce((sum: number, r: any) => sum + (r.amount || 0), 0)

  return (
    <div className="flex-1 space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Revenue at Risk</h2>
        <p className="text-muted-foreground mt-1">All detected revenue risk events across channels.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue at Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-500">₹{totalAtRisk.toLocaleString('en-IN')}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Risk Events Detected</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{risks.length}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">High Priority</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">
              {risks.filter((r: any) => r.risk_score >= 0.7).length}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Risk Event Register</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Risk ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Risk Type</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Risk Score</TableHead>
                <TableHead>Detected At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center">Loading...</TableCell></TableRow>
              ) : risks.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No risk events detected.</TableCell></TableRow>
              ) : risks.map((r: any, i: number) => (
                <TableRow key={r.id || i}>
                  <TableCell className="font-medium text-primary text-xs">{r.id}</TableCell>
                  <TableCell className="text-xs">{r.customer_id}</TableCell>
                  <TableCell><Badge variant={RISK_COLOR[r.risk_type] || 'outline'}>{r.risk_type}</Badge></TableCell>
                  <TableCell>₹{(r.amount || 0).toLocaleString('en-IN')}</TableCell>
                  <TableCell>
                    <span className={`font-semibold ${r.risk_score >= 0.7 ? 'text-red-500' : 'text-amber-500'}`}>
                      {Math.round((r.risk_score || 0) * 100)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
