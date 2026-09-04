"use client"
import { useQuery } from '@tanstack/react-query'
import { getCustomers } from '@/services/misc.api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Users, Search } from 'lucide-react'
import { useState } from 'react'

export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const { data: customers = [], isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: getCustomers,
    refetchInterval: 20000,
  })

  const filtered = customers.filter((c: any) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.id?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Customers</h2>
          <p className="text-muted-foreground mt-1">All customers tracked in the recovery system.</p>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Users className="h-4 w-4" /> {customers.length} total
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
          <CardTitle>Customer Directory</CardTitle>
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              placeholder="Search name, email, ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-background pl-8 rounded-md border h-9 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center">Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No customers found.</TableCell></TableRow>
              ) : filtered.map((c: any, i: number) => (
                <TableRow key={c.id || i}>
                  <TableCell className="font-medium text-primary">{c.id}</TableCell>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell>{c.phone || '—'}</TableCell>
                  <TableCell>{c.created_at ? new Date(c.created_at).toLocaleDateString() : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
