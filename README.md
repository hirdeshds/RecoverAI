# RecoverAI

AI Revenue Recovery Agent scaffold based on the attached build documentation.

## Folder Structure

```text
RecoverAI/
├── server/
│   ├── api.py                   # FastAPI server & route handlers (events, cases, dashboard, exports)
│   ├── agent.py                 # State machine loop, decision table, executors, verification, LLM/Stripe integrations
│   ├── models.py                # Database helper, domain models, and schemas
│   └── tests.py                 # Unified backend and worker tests
├── frontend/
│   ├── App.tsx                  # React App shell, routing, hooks, API client
│   ├── components.tsx           # Audit timeline, layout, compliance panel components
│   ├── index.css                # Style config
│   └── tests.tsx                # Frontend UI tests
├── Dockerfile                   # Consolidated production container build
├── docker-compose.yml           # Unified local multi-service container setup
├── setup.sql                    # Database migrations, schema, and seed data
├── manage.py                    # Unified CLI script for migrations, seed data, run-tests, resets
├── config.json                  # Local configuration template
└── DOCUMENTATION.md             # Consolidated playbooks, rules, compliance policies & API contracts
```

## Suggested Build Order

1. Backend ingestion and normalized `RevenueEvent` contracts.
2. Database migrations for `cases`, `case_events`, and `suppressions`.
3. Recovery worker state machine and guardrail engine.
4. Sandbox integrations for payments and messaging.
5. React dashboard with recovery metrics, audit viewer, and compliance panel.
6. Synthetic batch runner and demo scripts.

