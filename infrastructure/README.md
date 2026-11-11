# Infrastructure

A deployment target has intentionally not been selected. The app supports a future home-hosted or hybrid deployment.

Production decisions to make: domain/DNS, TLS and tunnel, private object storage, PostgreSQL backup encryption/retention, automated restoration tests, ingress policy, log redaction, uptime monitoring, secret distribution and off-site disaster recovery.

Never expose PostgreSQL, SSH or private media storage directly to the public internet.
