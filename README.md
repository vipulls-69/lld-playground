# LLD Playground

A production-ready Low-Level Design (LLD) practice platform — an infinite-canvas UML editor with live code generation, a SOLID design auditor, and an interactive LLD problem suite. Built to feel like a native developer tool (VS Code / Linear / Figma).

## Features

- **Infinite UML canvas** — class, abstract, interface, enum, record, actor, lifeline, state, package, and note nodes with flat, technical styling
- **Inline editing** — double-click any block to edit name, fields, methods, params, and stereotypes in place; single-box signature editing with type autocomplete (TS primitives + workspace types)
- **Design-pattern library** — one-click Singleton, Factory, Builder, Observer, Strategy, and more, plus custom stereotypes
- **Relationships** — association, aggregation, composition, generalization, realization, dependency with orthogonal routing and on-canvas edge editing
- **Code generation** — diagram → skeleton code in TypeScript, Java, C++, Python, and Go
- **Mermaid two-way sync** — canvas ⇄ Mermaid class-diagram syntax
- **SOLID auditor** — static analysis of the schema (SRP, DIP, ISP, LSP, coupling, encapsulation)
- **LLD problem bank** — Parking Lot, Elevator, Rate Limiter, Chess, Splitwise, BookMyShow with expected-class auto-detection
- **VS Code shell** — activity bar, collapsible sidebar, command palette (`Ctrl/Cmd+K`), status bar, minimap, undo/redo (`zundo`), light/dark themes
- **Persistence** — auto-save to `localStorage`, import/export workspace as `.json`

## Tech Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · `@xyflow/react` · `@monaco-editor/react` · Zustand + `zundo` · Radix UI · Lucide · Mermaid

## Develop

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Build

```bash
npm run build
npm start
```

## Deploy to Vercel

The repo is deploy-ready (includes `vercel.json`).

**One-click:**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

**CLI:**

```bash
npm i -g vercel
vercel        # preview
vercel --prod # production
```

No environment variables are required. The app is fully client-side; the only route (`/`) is statically prerendered.

## Project Structure

```text
src/
├── app/                  # layout, page, globals.css
├── components/
│   ├── canvas/           # nodes, edges, React Flow editor
│   ├── editor/           # Monaco code editor
│   ├── sidebar/          # activity bar, shape library, auditor, status bar, toolbar
│   ├── modals/           # command palette
│   └── ui/               # minimal shadcn-style primitives
├── lib/
│   ├── codegen/          # OOP generators (Java, C++, TS, Python, Go)
│   ├── mermaid/          # diagram ⇄ Mermaid conversion
│   ├── audit/            # SOLID auditor
│   ├── data/             # LLD problem bank
│   └── utils/            # helpers, persistence
└── store/                # Zustand stores (canvas, UI, challenge)
```
