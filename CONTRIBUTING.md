# Contributing to X-Dispatch

Thanks for your interest in contributing. This guide covers the contributor workflow this repo actually expects, not just the bare minimum to get it running.

## Before You Start

- Use Node.js 24+ and npm.
- X-Plane 12.4+ is only required for simulator-facing work and manual integration testing.
- Read [README.md](README.md) for user-facing setup, then review the existing code patterns before introducing new structure or abstractions.
- Check for an existing issue before you start. If there is no issue for the bug, feature, or refactor you want to work on, open one first and outline the scope of the change.

## Development Setup

1. Fork and clone the repository
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

1. Open or link an issue that describes the bug, feature, or scope of the change
2. Create a fresh feature branch from the latest `main`
3. Make your changes with clear commit messages
4. Run `npm run check` and any relevant tests (`npm run test:run`, `npm run test:e2e` when applicable)
5. Add screenshots for UI changes and manual validation notes for X-Plane-facing changes
6. Open a PR with a clear description of changes
7. Link the related issue in the PR

## Reporting Issues

- Use the issue templates for bugs and feature requests
- Include reproduction steps for bugs
- Check existing issues before creating duplicates

## Questions?

Open a discussion or issue if you need help getting started.
