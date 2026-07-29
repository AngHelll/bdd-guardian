# BDD Guardian CLI & MCP

Headless inventory, map analysis, step resolve, and Coach findings for agents and CI — **no VS Code Extension Host**.

## Commands

```bash
npm run compile   # once (or after pulling)
npm run guardian -- discover <project-dir>
npm run guardian -- analyze <project-dir> [--max-items <n>]
npm run guardian -- resolve-step <project-dir> <feature-path> <line>
npm run guardian -- coach-analyze <project-dir> [--feature <path>] [--max-items <n>]
npm run guardian:mcp   # MCP stdio server
```

| Exit | Meaning |
|------|---------|
| `0` | OK (JSON on stdout) |
| `1` | I/O or load error |
| `2` | Usage / bad args |

`--max-items` (default **50**) caps detail arrays in `analyze` / `coach-analyze`. Counts are always complete.

`resolve-step` **line** is **0-based** (same as Index API `resolveStep`).

## Output

JSON with `schemaVersion: 1`.

- **discover** — features (path + stepCount), bindings (path + pattern + providerId), `providersDetected`
- **analyze** — `counts` (features, steps, bindings, bound, unbound, ambiguous, orphanBindings) plus capped detail lists
- **resolve-step** — `status` (`bound` / `unbound` / `ambiguous` / `no_step`), `matches[]`, English `why` when ambiguous
- **coach-analyze** — `counts.files` / `findings` / `byRuleId`, capped `findings[]` (no quick fixes)

Matching uses the same resolver path as the extension (`preferSpecificBinding: false`).

## MCP (stdio)

Thin MCP server that calls the **same** report builders as the CLI.

```bash
npm run compile
npm run guardian:mcp
```

| Tool | Args |
|------|------|
| `guardian_discover` | `projectDir` |
| `guardian_analyze` | `projectDir`, `maxItems?` |
| `guardian_resolve_step` | `projectDir`, `featurePath`, `line` (0-based) |
| `guardian_coach_analyze` | `projectDir`, `featurePath?`, `maxItems?` |

**Cursor / MCP client example** (stdio):

```json
{
  "mcpServers": {
    "bdd-guardian": {
      "command": "node",
      "args": ["scripts/guardian-mcp.js"],
      "cwd": "/absolute/path/to/bdd-guardian"
    }
  }
}
```

Requires a prior `npm run compile` so `out/cli/mcpServer.js` exists. Local paths only; no network tools; does not run tests.

**Smoke:** after compile, an MCP client `tools/list` should show the four tools; `guardian_discover` on `samples/binding-demo` returns JSON with bindings.

## Notes

- Does **not** run tests (use [BDD Pilot](https://github.com/AngHelll/bdd-pilot) for execution).
- Does **not** replace Index API `extension.exports` for in-process companions.
- Scripts live under `scripts/`; they are excluded from the Marketplace VSIX (`.vscodeignore`).
