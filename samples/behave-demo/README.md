# behave-demo — Capa B (Python Behave)

Minimal [Behave](https://behave.readthedocs.io/) workspace for manual verification of BDD Guardian `python-behave` provider.

## Capa B (extras for v0.7.1+)

1. Install `bdd-guardian.vsix` (Extensions → … → Install from VSIX…)
2. **File → Open Folder…** → this directory
3. Wait for status bar **Ready** (or **BDD Guardian: Reindex**)
4. Open **Output → BDD Guardian** — expect **Python Behave: ACTIVE** and bindings indexed
5. Open `features/search.feature`
6. Verify:
   - CodeLens shows bound steps on all three steps
   - **Go to Definition** (F12) navigates to `features/steps/search_steps.py`
   - Gutter / Problems show bound status (diagnostics enabled)

## Run tests (optional)

Requires Python 3 and Behave:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
behave
```

Guardian navigation does not execute tests; use [BDD Pilot](https://github.com/AngHelll/bdd-pilot) for execution workflows where supported.
