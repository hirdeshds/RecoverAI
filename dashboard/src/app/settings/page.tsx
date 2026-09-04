"use client"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Settings } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-7 w-7 text-primary" />
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
          <p className="text-muted-foreground mt-1">Platform configuration and preferences.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Backend Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { key: 'API Base URL', value: 'http://localhost:5000/api/v2' },
              { key: 'Authentication', value: 'X-API-Key (header)' },
              { key: 'AI Provider', value: 'Groq (Llama 3)' },
              { key: 'Payment Provider', value: 'Razorpay (Test Mode)' },
              { key: 'Database', value: 'SQLite (recoverai.db)' },
            ].map(({ key, value }) => (
              <div key={key} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-sm font-medium text-muted-foreground">{key}</span>
                <span className="text-sm font-mono">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Guardrail Limits</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {[
              { key: 'Max Contact Frequency', value: '2 contacts / 24h' },
              { key: 'Max Recovery Attempts', value: '3 per case' },
              { key: 'Max Escalation Level', value: '2' },
              { key: 'High-Value Threshold', value: '₹50,000' },
              { key: 'Auto-Stop Conditions', value: 'Active' },
            ].map(({ key, value }) => (
              <div key={key} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-sm font-medium text-muted-foreground">{key}</span>
                <span className="text-sm font-mono">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
