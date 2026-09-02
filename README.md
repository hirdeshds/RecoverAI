# RecoverAI

AI Revenue Recovery Agent platform for Razorpay.

## Directory Structure

```text
recoverAI/
├── README.md
├── .env.example
├── package.json
│
├── db/
│   ├── schema.sql
│   └── seed.js
│
├── backend/
│   ├── server.js
│   ├── webhook.js
│   ├── razorpay.js
│   ├── diagnosis.js
│   ├── decision.js
│   ├── executor.js
│   └── metrics.js
│
└── frontend/
    ├── pages/
    ├── components/
    └── api.js
```

## How to Run

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Configure Environment**:
   ```bash
   cp .env.example .env
   ```

3. **Seed Database**:
   ```bash
   npm run seed
   ```

4. **Start Server**:
   ```bash
   npm start
   ```
   Open `http://localhost:5000` in your browser.
