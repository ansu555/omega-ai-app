# ATS Marketplace Documentation

This folder expands the Agentic Trading System marketplace into an implementation-ready product spec.

The marketplace is the strategy and indicator ecosystem for ATS. Creators publish reusable trading logic. Users browse, evaluate, activate, and execute strategies. The platform measures performance through receipts, paper trading, controlled live execution, and strategy version history.

## Documents

| File | Purpose |
|---|---|
| [full-implementation.md](full-implementation.md) | Complete marketplace implementation idea, including domain model, flows, execution integration, scoring, quality gates, APIs, security, and rollout. |
| [mvp.md](mvp.md) | MVP-only scope. This is the first build target and includes creator publishing, indicator publishing, marketplace browsing, strategy activation, execution, receipts, and quality gates. |

## Core Marketplace Promise

The marketplace should not be a list of strategy cards with marketing claims. It should be a trust system.

Every published strategy must answer:

- What does this strategy do?
- Who created it?
- Which indicators and data sources does it depend on?
- What regimes is it allowed to run in?
- What risk limits protect the user?
- Has it passed validation?
- Has it passed paper trading?
- What happened when users or agents executed it?
- Can the user inspect the receipt for every execution?

## Non-Negotiable Product Principles

1. Marketplace strategies must be versioned.
2. Backtest results must never be mixed with live or paper performance.
3. Every strategy must define entry logic, exit logic, regime compatibility, and risk limits.
4. Every executable strategy must produce a Decision Receipt.
5. Users must explicitly activate a strategy before it can execute.
6. Users must be able to set allocation and execution limits per strategy.
7. Published indicators must be typed, documented, testable, and reusable.
8. The platform must support delisting, pausing, and watch status for unsafe or misleading strategies.
9. A strategy cannot earn trust only by description, branding, or creator claims.
10. The MVP must support real end-to-end marketplace usage: build, publish, activate, execute, and review.
11. The marketplace must not replace the current strategy-builder-to-DEX execution flow. It only adds publishing, discovery, activation, permissions, and receipt tracking around the existing flow.

## Relationship To Existing Docs

This folder builds on:

- [../idea.md](../idea.md) for the larger ATS platform vision.
- [../ATS_Marketplace_Design.md](../ATS_Marketplace_Design.md) for marketplace user flows and page concepts.

The older marketplace design document is useful as the UX foundation. The files in this folder define what needs to exist behind those screens so the marketplace can actually work.
