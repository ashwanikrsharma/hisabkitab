# Tech Design Documents

This folder contains architecture decision records and technical designs for HisabKitab features. Every non-trivial feature must have a design document here **before** implementation begins.

## Index

| Document | Status | Date | Summary |
|----------|--------|------|---------|
| [architecture-principles.md](./architecture-principles.md) | Approved | 2026-03-20 | Foundational architecture, layering rules, best practices |

## Process

1. The **architect-agent** creates a design document for each new feature
2. The **orchestrator** distributes relevant sections to implementation agents
3. Implementation agents follow the design as a binding contract
4. The **review-agent** verifies the implementation against the design
5. The architect-agent updates the document status to "Implemented" after review passes

## Document Lifecycle

- **Draft** — Design created, awaiting review
- **Approved** — Design reviewed and accepted, ready for implementation
- **Implemented** — Code matches the design, verified by review-agent
- **Superseded** — Replaced by a newer design (link to successor)
