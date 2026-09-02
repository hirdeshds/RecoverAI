function Header({ title }) {
    return `
        <header style="background: #1e293b; padding: 1.5rem; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center;">
            <h1 style="margin: 0; color: #38bdf8; font-size: 1.5rem;">${title}</h1>
            <span style="background: #0369a1; color: #e0f2fe; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.875rem;">Razorpay Integrated</span>
        </header>
    `;
}

function MetricCard({ label, value, subtext }) {
    return `
        <div style="background: #1e293b; padding: 1.5rem; border-radius: 12px; border: 1px solid #334155;">
            <div style="color: #94a3b8; font-size: 0.875rem; font-weight: 500;">${label}</div>
            <div style="color: #f8fafc; font-size: 1.875rem; font-weight: 700; margin-top: 0.5rem;">${value}</div>
            ${subtext ? `<div style="color: #34d399; font-size: 0.75rem; margin-top: 0.25rem;">${subtext}</div>` : ''}
        </div>
    `;
}

module.exports = { Header, MetricCard };
