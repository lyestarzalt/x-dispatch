# Development Guide

Internal guide for working on X-Dispatch. X-Dispatch is proprietary (see [LICENSE](LICENSE)); outside contributions are not accepted.

## Before You Start

- Use Node.js 24+ and npm.
- X-Plane 12.4+ is only required for simulator-facing work and manual integration testing.
- Read [README.md](README.md) for user-facing setup, then review the existing code patterns before introducing new structure or abstractions.

## Development Setup

1. Clone the repository
2. Use Node.js 24+
3. Install dependencies: `npm install`
4. Start development: `npm start`
5. Use `npm run start:fresh` when debugging scenery, nav-data, or cache-related behavior

## Daily Workflow

- Keep PRs focused on a single change
- Start each contribution from a fresh branch created from the latest `main`
- Follow existing patterns before introducing new abstractions
- Put temporary drafts, notes, and scratch files in `docs/`, not the project root or `src/`
- Treat `src/i18n/locales/en.json` as the source of truth; if English changes, keep the other locale files in sync

## Validation and Tests

- Run `npm run check` before committing. It covers typecheck, lint, and formatting; it does **not** run tests.
- Run `npm run test:run` when you change app logic, parsers, stores, launch flow, or i18n.
- Run `npm run test:e2e` when you change UI flows that are covered by Playwright.
- Bug fixes and new features should include tests when applicable. For bug fixes, start with a failing test.
- Colocate tests with source files using `*.test.ts` or `*.test.tsx`.

## Repo-Specific Notes

- Do not remove the `@maplibre/maplibre-gl-style-spec` `24.8.1` override unless you have verified that `npm run check` still passes after the dependency change.
- For locale edits, `npm run test:run -- src/i18n/localeParity.test.ts` checks every registered locale against `en.json`.
- If you touch launch or simulator integration behavior, include manual X-Plane validation notes in your PR.

## Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add dark mode toggle
fix: resolve map layer displacement
refactor: simplify flight plan parser
docs: update installation instructions
chore: update dependencies
```

Use these commit types: `feat`, `fix`, `refactor`, `chore`, `docs`.

## Pull Request Process

1. Create a fresh feature branch from the latest `main`
2. Make your changes with clear commit messages
3. Run `npm run check` and any relevant tests (`npm run test:run`, `npm run test:e2e` when applicable)
4. Add screenshots for UI changes and manual validation notes for X-Plane-facing changes
5. Open a PR with a clear description of changes

## Reporting Issues

Users report problems on [Discord](https://discord.gg/76UYpxXWW7), through the in-app feedback form, or at hello@x-dispatch.app.
