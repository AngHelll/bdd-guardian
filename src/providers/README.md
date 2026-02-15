# Providers

This folder contains two kinds of providers:

## 1. Editor / VS Code providers in this directory

- **bindingCodeLensProvider** — CodeLens above step definition methods (e.g. “2 usages”, “Go to step usage”). Registered in `extension.ts` for C#, TypeScript, JavaScript, Python, Go. Uses `IndexManager` / `WorkspaceIndex` from `core/index`.

Other editor providers (definition, hover, code lens above steps, diagnostics, decorations) live in **`features/`** and also use `IndexManager` and the core resolver.

## 2. Binding providers (`bindings/`)

Framework-specific **binding providers** that detect and parse step definitions:

- **providerManager** — Registers providers and runs detection
- **csharpReqnrollProvider** / **csharpSpecflowProvider** — C# Reqnroll/SpecFlow
- **jsCucumberProvider**, **javaCucumberProvider**, **pythonBehaveProvider**, etc. — Other BDD frameworks

Each binding provider implements `IBindingProvider`: detection, file pattern, and parsing of binding files. See `docs/PROVIDERS.md` for how to add a new framework.
