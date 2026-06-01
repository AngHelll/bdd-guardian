# godog-demo — Capa B (Go Godog)

Minimal [Godog](https://github.com/cucumber/godog) workspace for manual verification of BDD Guardian `go-godog` provider.

## Capa B (extras for v0.7.0)

1. Install `bdd-guardian.vsix` (Extensions → … → Install from VSIX…)
2. **File → Open Folder…** → this directory
3. Wait for status bar **Ready** (or **BDD Guardian: Reindex**)
4. Open **Output → BDD Guardian** — expect **Go Godog: ACTIVE** and bindings indexed
5. Open `features/godogs.feature`
6. Verify:
   - CodeLens shows bound steps
   - **Go to Definition** (F12) opens `godogs_test.go` on the matching handler

## Run tests (optional)

Requires Go toolchain:

```bash
go test -v
```

Guardian navigation does not execute tests; use [BDD Pilot](https://github.com/AngHelll/bdd-pilot) for execution workflows.
