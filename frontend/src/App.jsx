import React, { useState, useEffect, useRef } from 'react';
import { 
    LayoutDashboard, Activity, CreditCard, Brain, ShieldAlert, MessageSquare,
    RefreshCw, PlayCircle, AlertTriangle, CheckCircle2, TrendingUp, Loader,
    ShieldBan, Workflow, Rss, ExternalLink, Zap
} from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);
ChartJS.defaults.color = '#cbd5e1';
ChartJS.defaults.font.family = 'Inter';

const HEADERS = {
    'X-API-Key': 'track03_dev_key',
    'Content-Type': 'application/json'
};

export default function App() {
    const [metrics, setMetrics] = useState({
        total_revenue_at_risk: 0,
        recovered_revenue: 0,
        recovery_rate_percent: 0,
        pending_interventions: 0
    });
    
    const [auditLogs, setAuditLogs] = useState([]);
    const [cases, setCases] = useState([]);
    
    const [causeCounts, setCauseCounts] = useState({});
    const [eventCounts, setEventCounts] = useState({});
    
    const [paymentAmount, setPaymentAmount] = useState(1499);
    const [customerEmail, setCustomerEmail] = useState("alex.merchant@example.com");
    const [failureScenario, setFailureScenario] = useState("INSUFFICIENT_FUNDS");
    const [paymentStatus, setPaymentStatus] = useState("");
    const [isBatchRunning, setIsBatchRunning] = useState(false);
    
    // Pipeline State
    const [pipelineVisible, setPipelineVisible] = useState(false);
    const [pipelineGlobalMsg, setPipelineGlobalMsg] = useState("Running AI Agent Pipeline...");
    const [pipelineGlobalClass, setPipelineGlobalClass] = useState("badge-purple");
    
    const [pipelineNodes, setPipelineNodes] = useState([
        { id: 1, title: "Webhook Ingest", icon: <Rss size={18} />, statusClass: "waiting", badgeClass: "badge-blue", badgeText: "Waiting", desc: "Standing by...", meta: "—" },
        { id: 2, title: "Risk Detection", icon: <Brain size={18} />, statusClass: "waiting", badgeClass: "badge-blue", badgeText: "Waiting", desc: "Standing by...", meta: "—" },
        { id: 3, title: "AI Decision", icon: <Activity size={18} />, statusClass: "waiting", badgeClass: "badge-blue", badgeText: "Waiting", desc: "Standing by...", meta: "—" },
        { id: 4, title: "Recovery Action", icon: <Zap size={18} />, statusClass: "waiting", badgeClass: "badge-blue", badgeText: "Waiting", desc: "Standing by...", meta: "—" }
    ]);

    const loadDashboardData = async () => {
        try {
            const resM = await fetch('/api/v2/metrics/recovery', { headers: HEADERS });
            const dataM = await resM.json();
            setMetrics({
                total_revenue_at_risk: dataM.revenue_at_risk || 0,
                recovered_revenue: dataM.total_recovered || 0,
                recovery_rate_percent: dataM.recovery_rate_percent || 0,
                pending_interventions: dataM.active_promises || 0
            });
            
            const resA = await fetch('/api/v2/audit-logs?limit=50', { headers: HEADERS });
            const logs = await resA.json();
            setAuditLogs(logs);

            const resC = await fetch('/api/v2/recovery-cases', { headers: HEADERS });
            const casesData = await resC.json();
            setCases(casesData);
            
            const cCounts = {};
            const eCounts = {};
            logs.forEach(log => {
                const action = log.action || 'Unknown';
                const evType = log.entity_type || 'Unknown';
                cCounts[action] = (cCounts[action] || 0) + 1;
                eCounts[evType] = (eCounts[evType] || 0) + 1;
            });
            setCauseCounts(cCounts);
            setEventCounts(eCounts);
        } catch (err) {
            console.error("Error loading dashboard data", err);
        }
    };

    useEffect(() => {
        loadDashboardData();
    }, []);

    const triggerBatchRun = async () => {
        setIsBatchRunning(true);
        try {
            await fetch('/api/v2/recovery/batch/run-sync', { method: 'POST', headers: HEADERS });
            await loadDashboardData();
        } catch (err) {
            console.error(err);
        } finally {
            setIsBatchRunning(false);
        }
    };

    const simulateCustomerPayment = async (caseId, invoiceId, customerId, amount) => {
        try {
            const res = await fetch(`/api/v2/payments`, { 
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify({
                    external_payment_id: "pay_sim_" + Math.random().toString(36).substr(2, 9),
                    customer_id: customerId,
                    invoice_id: invoiceId,
                    amount: amount,
                    currency: "INR",
                    status: "captured",
                    payment_method: "upi"
                })
            });
            if (res.ok) {
                await loadDashboardData();
            } else {
                console.error("Failed to simulate recovery");
            }
        } catch (err) {
            console.error(err);
        }
    };

    const updatePipelineNode = (idx, updates) => {
        setPipelineNodes(prev => prev.map(n => n.id === idx ? { ...n, ...updates } : n));
    };

    const resetPipeline = () => {
        setPipelineVisible(true);
        setPipelineGlobalMsg("Running AI Agent Pipeline...");
        setPipelineGlobalClass("badge-purple");
        setPipelineNodes(prev => prev.map(n => ({
            ...n, statusClass: "waiting", badgeClass: "badge-blue", badgeText: "Waiting", desc: "Standing by...", meta: "—"
        })));
    };

    const triggerSimulatedFailure = async (customParams = null) => {
        let amt = paymentAmount;
        let em = customerEmail;
        let scenario = failureScenario;
        let eventType = "invoice.payment_failed";

        if (scenario === "HIGH_VALUE_THRESHOLD") amt = 75000;
        if (scenario === "USER_ABANDONED") eventType = "checkout.abandoned";
        if (scenario === "CARD_EXPIRED") eventType = "payment.failed";
        if (scenario === "BANK_TIMEOUT") eventType = "payment.error";

        if (customParams) {
            if (customParams.amount) amt = customParams.amount;
            if (customParams.email) em = customParams.email;
            if (customParams.error_code === "USER_ABANDONED") eventType = "checkout.abandoned";
            else if (customParams.error_code) eventType = "payment.failed";
        }

        resetPipeline();
        setPaymentStatus("Simulating payment failure & invoking live autonomous recovery agent pipeline...");

        try {
            updatePipelineNode(1, { statusClass: "active", badgeClass: "badge-purple", badgeText: "Processing...", desc: "Ingesting Webhook" });
            
            // 1. Create Customer
            const custRes = await fetch('/api/v2/customers', {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify({
                    name: "Simulated Customer",
                    email: em,
                    phone: "+919876543210"
                })
            });
            if (!custRes.ok) throw new Error("Failed to create customer");
            const cust = await custRes.json();
            
            // 2. Create Invoice
            const due = new Date();
            if (scenario === "BANK_TIMEOUT") due.setDate(due.getDate() - 30);
            const invRes = await fetch('/api/v2/invoices', {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify({
                    customer_id: cust.customer_id,
                    amount: amt,
                    currency: "INR",
                    due_date: due.toISOString()
                })
            });
            if (!invRes.ok) {
                const errDetail = await invRes.text();
                throw new Error("Failed to create invoice: " + errDetail);
            }
            const inv = await invRes.json();
            
            updatePipelineNode(1, { statusClass: "completed", badgeClass: "badge-success", badgeText: "Done", meta: `Event: ${eventType}` });
            updatePipelineNode(2, { statusClass: "active", badgeClass: "badge-purple", badgeText: "Processing...", desc: "Detecting Risk" });
            
            // 3. Risk Event
            const riskRes = await fetch('/api/v2/risk-events', {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify({
                    event_type: eventType,
                    customer_id: cust.customer_id,
                    amount: amt,
                    currency: "INR",
                    invoice_id: inv.invoice_id,
                    days_overdue: scenario === "BANK_TIMEOUT" ? 30 : 5
                })
            });
            if (!riskRes.ok) throw new Error("Failed to create risk event");
            const risk = await riskRes.json();
            
            updatePipelineNode(2, { statusClass: "completed", badgeClass: "badge-success", badgeText: "Done", meta: `Case: ${risk.case_id} (Score: ${risk.risk_score})` });
            updatePipelineNode(3, { statusClass: "active", badgeClass: "badge-purple", badgeText: "Processing...", desc: "LLM Deciding Strategy" });

            // 4. AI Decide
            const decideRes = await fetch(`/api/v2/recovery-cases/${risk.case_id}/decide`, {
                method: 'POST',
                headers: HEADERS
            });
            if (!decideRes.ok) throw new Error("Failed AI decision engine");
            const decide = await decideRes.json();
            
            if (decide.status === 'stopped') {
                updatePipelineNode(3, { statusClass: "stopped", badgeClass: "badge-warning", badgeText: "Stopped", meta: decide.reason, desc: "Safeguard Fired" });
                updatePipelineNode(4, { statusClass: "stopped", badgeClass: "badge-warning", badgeText: "Skipped", meta: "Execution blocked" });
                setPipelineGlobalMsg("Pipeline Stopped by Safeguard");
                setPipelineGlobalClass("badge-warning");
            } else {
                updatePipelineNode(3, { statusClass: "completed", badgeClass: "badge-success", badgeText: "Done", meta: `Action: ${decide.decision.action_type}` });
                updatePipelineNode(4, { statusClass: "completed", badgeClass: "badge-success", badgeText: "Done", meta: `Executed via ${decide.decision.channel}` });
                setPipelineGlobalMsg("Pipeline Execution Finished");
                setPipelineGlobalClass("badge-success");
            }

            setPaymentStatus(`Pipeline Finished for ₹${amt.toLocaleString('en-IN')}`);
            loadDashboardData();

        } catch (err) {
            setPaymentStatus(`Error running pipeline: ${err.message}`);
        }
    };

    const startPayment = async () => {
        if (!paymentAmount || paymentAmount <= 0) {
            setPaymentStatus('Please specify a valid amount in INR.');
            return;
        }

        setPaymentStatus('Generating secure Razorpay order...');
        try {
            const orderResponse = await fetch('/api/payments/create-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: paymentAmount, customer_email: customerEmail })
            });
            const order = await orderResponse.json();
            if (!orderResponse.ok) throw new Error(order.detail || 'Failed to create order');

            const checkout = new window.Razorpay({
                key: order.key_id,
                amount: order.amount,
                currency: order.currency,
                name: 'recoverAI Platform',
                description: 'Revenue recovery demo transaction',
                order_id: order.order_id,
                prefill: { email: order.customer.email },
                handler: async function (response) {
                    setPaymentStatus('Verifying payment cryptographic signature...');
                    const result = await fetch('/api/payments/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(response)
                    });
                    const data = await result.json();
                    setPaymentStatus(result.ok ? `Payment verified & captured: ${data.payment_id}` : data.detail);
                    if (result.ok) loadDashboardData();
                },
                modal: {
                    ondismiss: () => {
                        setPaymentStatus('Transaction modal closed by user.');
                        triggerSimulatedFailure({
                            amount: paymentAmount,
                            email: customerEmail,
                            error_code: "USER_ABANDONED",
                            error_description: "Customer closed payment modal without attempting authorization"
                        });
                    }
                }
            });

            checkout.on('payment.failed', (evt) => {
                setPaymentStatus(evt.error.description || 'Payment execution failed.');
                triggerSimulatedFailure({
                    amount: paymentAmount,
                    email: customerEmail,
                    error_code: evt.error.code || "BAD_REQUEST_PAYMENT_FAILED",
                    error_description: evt.error.description || "Razorpay checkout authorization failed"
                });
            });

            checkout.open();
        } catch (err) {
            setPaymentStatus(err.message);
        }
    };

    const causeData = {
        labels: Object.keys(causeCounts).map(k => k.replace(/_/g, ' ').toUpperCase()),
        datasets: [{
            data: Object.values(causeCounts),
            backgroundColor: ['#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'],
            borderColor: 'rgba(15, 23, 42, 0.8)',
            borderWidth: 2
        }]
    };

    const eventData = {
        labels: Object.keys(eventCounts).map(k => k.replace(/_/g, ' ').toUpperCase()),
        datasets: [{
            label: 'Entity Type Distribution',
            data: Object.values(eventCounts),
            backgroundColor: '#06b6d4',
            borderRadius: 4
        }]
    };

    return (
        <>
            <aside>
                <div className="logo-area">
                    <div className="logo-icon">R</div>
                    <div className="logo-text">recoverAI</div>
                    <span className="logo-badge">V2</span>
                </div>
                <div className="nav-section-title">Overview</div>
                <ul className="nav-menu">
                    <li className="nav-item active"><a href="#"><LayoutDashboard size={18} /> Executive View</a></li>
                    <li className="nav-item"><a href="#audit-section"><Activity size={18} /> Recovery Cases</a></li>
                    <li className="nav-item"><a href="#simulator-section"><CreditCard size={18} /> Payment Sandbox</a></li>
                </ul>
            </aside>

            <main>
                <header>
                    <div className="header-title">
                        <h1>Find revenue that's slipping away and win it back.</h1>
                        <p>Autonomous agent detecting revenue at risk, diagnosing root causes, and executing bounded recovery workflows.</p>
                    </div>
                    <div className="action-group">
                        <button className="btn btn-secondary" onClick={loadDashboardData}>
                            <RefreshCw size={18} /> Sync Data
                        </button>
                        <button className="btn btn-primary" onClick={triggerBatchRun} disabled={isBatchRunning}>
                            {isBatchRunning ? <Loader size={18} className="spin" /> : <PlayCircle size={18} />}
                            {isBatchRunning ? "Running batch..." : "Run Batch Simulation"}
                        </button>
                    </div>
                </header>

                <div className="metrics-grid">
                    <div className="metric-card">
                        <div className="metric-header">
                            <span className="metric-title">Total Revenue at Risk</span>
                            <div className="metric-icon-bg" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
                                <AlertTriangle size={20} />
                            </div>
                        </div>
                        <div className="metric-value" style={{ background: 'linear-gradient(to right, #ef4444, #f87171)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            ₹{metrics.total_revenue_at_risk.toLocaleString('en-IN')}
                        </div>
                        <div className="metric-subtitle"><AlertTriangle size={14} /> Active failed transactions</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-header">
                            <span className="metric-title">Recovered Revenue</span>
                            <div className="metric-icon-bg" style={{ background: 'var(--success-bg)', color: 'var(--success)' }}>
                                <CheckCircle2 size={20} />
                            </div>
                        </div>
                        <div className="metric-value" style={{ background: 'linear-gradient(to right, #10b981, #34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            ₹{metrics.recovered_revenue.toLocaleString('en-IN')}
                        </div>
                        <div className="metric-subtitle"><span className="pulse-dot"></span> Reclaimed to merchant bank</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-header">
                            <span className="metric-title">Recovery Success Rate</span>
                            <div className="metric-icon-bg" style={{ background: 'var(--accent-light)', color: 'var(--accent-primary)' }}>
                                <TrendingUp size={20} />
                            </div>
                        </div>
                        <div className="metric-value" style={{ background: 'linear-gradient(to right, #06b6d4, #2dd4bf)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            {metrics.recovery_rate_percent}%
                        </div>
                        <div className="metric-subtitle"><TrendingUp size={14} /> AI autonomous efficiency</div>
                    </div>
                    <div className="metric-card">
                        <div className="metric-header">
                            <span className="metric-title">Active Promises</span>
                            <div className="metric-icon-bg" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                                <Loader size={20} />
                            </div>
                        </div>
                        <div className="metric-value">{metrics.pending_interventions}</div>
                        <div className="metric-subtitle"><ShieldAlert size={14} /> Scheduled recovery actions</div>
                    </div>
                </div>

                <div className="section-card" id="simulator-section">
                    <div className="section-header">
                        <div className="section-title">
                            <CreditCard style={{ color: 'var(--accent-primary)' }} size={24} />
                            Razorpay Checkout Sandbox & Autonomous Agent Pipeline Simulator
                        </div>
                        <span className="badge badge-blue">Real-Time Autonomous Agent Pipeline</span>
                    </div>
                    <div className="payment-form">
                        <div className="input-group">
                            <label className="input-label">Amount (INR)</label>
                            <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className="input-field" />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Customer Email</label>
                            <input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className="input-field" />
                        </div>
                        <div className="input-group">
                            <label className="input-label">Simulated Failure Scenario</label>
                            <select value={failureScenario} onChange={e => setFailureScenario(e.target.value)} className="input-field">
                                <option value="INSUFFICIENT_FUNDS">Payment degradation → Insufficient Funds</option>
                                <option value="USER_ABANDONED">Checkout drop-off recovery</option>
                                <option value="CARD_EXPIRED">Failed-subscription recovery</option>
                                <option value="BANK_TIMEOUT">B2B receivables chaser</option>
                                <option value="HIGH_VALUE_THRESHOLD">Compliance safeguard limit (&gt;₹50k)</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignSelf: 'flex-end' }}>
                            <button className="btn btn-primary" onClick={startPayment}>
                                <ExternalLink size={18} /> Launch Checkout
                            </button>
                            <button className="btn" style={{ background: '#ef4444', color: 'white', border: 'none' }} onClick={() => triggerSimulatedFailure()}>
                                <Zap size={18} /> Simulate Payment Failure & Run Pipeline
                            </button>
                        </div>
                    </div>
                    <div style={{ marginTop: '1rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{paymentStatus}</div>

                    {pipelineVisible && (
                        <div className="pipeline-container" style={{ display: 'block' }}>
                            <div className="pipeline-header">
                                <div className="pipeline-title">
                                    <Workflow size={20} /> Live Autonomous Recovery Agent Pipeline Execution
                                </div>
                                <span className={`badge ${pipelineGlobalClass}`}>{pipelineGlobalMsg}</span>
                            </div>
                            <div className="pipeline-steps-grid">
                                {pipelineNodes.map(node => (
                                    <div key={node.id} className={`pipeline-node ${node.statusClass}`}>
                                        <div className="node-step-badge">
                                            <span>Step 0{node.id}</span>
                                            <span className={`badge ${node.badgeClass}`}>{node.badgeText}</span>
                                        </div>
                                        <div className="node-title">
                                            {node.icon} {node.title}
                                        </div>
                                        <div className="node-desc">{node.desc}</div>
                                        <div className="node-meta">{node.meta}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="charts-row">
                    <div className="chart-card">
                        <div className="section-header" style={{ marginBottom: '1rem' }}>
                            <div className="section-title" style={{ fontSize: '1rem' }}>Entity Interactions</div>
                        </div>
                        <div style={{ height: '220px' }}>
                            <Bar data={eventData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { grid: { color: 'rgba(255, 255, 255, 0.05)' } }, x: { grid: { display: false } } } }} />
                        </div>
                    </div>
                    <div className="chart-card">
                        <div className="section-header" style={{ marginBottom: '1rem' }}>
                            <div className="section-title" style={{ fontSize: '1rem' }}>Actions Taken</div>
                        </div>
                        <div style={{ height: '220px' }}>
                            <Doughnut data={causeData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
                        </div>
                    </div>
                </div>

                <div className="section-card" id="audit-section" style={{ marginBottom: '4rem' }}>
                    <div className="section-header">
                        <div className="section-title">Active Recovery Cases</div>
                        <span className="badge badge-purple">Real-Time Feed</span>
                    </div>
                    <div className="table-container">
                        <table className="custom-table">
                            <thead>
                                <tr>
                                    <th>Case ID</th>
                                    <th>Value at Risk</th>
                                    <th>Priority & Score</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cases.length === 0 ? (
                                    <tr>
                                        <td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                                            No cases found. Simulate a failure to generate one.
                                        </td>
                                    </tr>
                                ) : (
                                    cases.map((c, i) => {
                                        let statusBadge = <span className="badge badge-warning">{c.status}</span>;
                                        if (c.status === 'recovered') statusBadge = <span className="badge badge-success">Recovered</span>;
                                        if (c.status === 'stopped' || c.status === 'failed') statusBadge = <span className="badge badge-danger">{c.status}</span>;
                                        return (
                                            <tr key={i}>
                                                <td>
                                                    <strong style={{ color: 'var(--accent-primary)' }}>{c.id}</strong>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cust: {c.customer_id}</div>
                                                </td>
                                                <td><strong>₹{(c.amount_at_risk || 0).toLocaleString('en-IN')}</strong></td>
                                                <td>
                                                    <div><span className="badge badge-blue">{c.priority}</span></div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>Score: {c.risk_score}</div>
                                                </td>
                                                <td>{statusBadge}</td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        {c.status === 'open' && (
                                                            <button 
                                                                className="btn btn-primary" 
                                                                style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                                                onClick={() => simulateCustomerPayment(c.id, c.invoice_id, c.customer_id, c.amount_at_risk)}
                                                            >
                                                                Simulate Customer Pay
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </>
    );
}
