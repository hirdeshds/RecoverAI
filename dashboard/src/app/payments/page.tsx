"use client"
import { useQuery } from '@tanstack/react-query'
import { getPayments } from '@/services/misc.api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

const STATUS_VARIANT: Record<string, any> = {
  captured: 'success',
  failed: 'destructive',
  pending: 'warning',
  refunded: 'outline',
}

export default function PaymentsPage() {
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: getPayments,
    refetchInterval: 15000,
  })

  const counts = {
    all: payments.length,
    captured: payments.filter((p: any) => p.status === 'captured').length,
    failed: payments.filter((p: any) => p.status === 'failed').length,
    pending: payments.filter((p: any) => p.status === 'pending').length,
  }

  return (
    <div className="flex-1 space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Payment Monitoring</h2>
        <p className="text-muted-foreground mt-1">All payment events integrated with Razorpay data.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {Object.entries(counts).map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium capitalize">{label}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>All Payments</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payment ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Failure Reason</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="h-24 text-center">Loading...</TableCell></TableRow>
              ) : payments.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No payments found.</TableCell></TableRow>
              ) : payments.map((p: any, i: number) => (
                <TableRow key={p.id || i}>
                  <TableCell className="font-medium text-primary text-xs">{p.id}</TableCell>
                  <TableCell className="text-xs">{p.customer_id}</TableCell>
                  <TableCell className="text-xs">{p.invoice_id || '—'}</TableCell>
                  <TableCell>₹{(p.amount || 0).toLocaleString('en-IN')}</TableCell>
                  <TableCell>{p.payment_method || '—'}</TableCell>
                  <TableCell><Badge variant={STATUS_VARIANT[p.status] || 'outline'}>{p.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.failure_reason || '—'}</TableCell>
                  <TableCell className="text-xs">{p.created_at ? new Date(p.created_at).toLocaleDateString() : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
