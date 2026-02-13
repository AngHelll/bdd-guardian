# Contributing to Reqnroll Navigator

First off, thank you for considering contributing to Reqnroll Navigator! 🎉

## 📜 Code of Conduct

This project and everyone participating in it is governed by our commitment to providing a welcoming and inclusive environment. Please be respectful and constructive in all interactions.

## 🚀 How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates.

When creating a bug report, include:
- Clear and descriptive title
- Steps to reproduce the problem
- Expected vs actual behavior
- Screenshots if applicable
- Your environment details (OS, VS Code version, extension version)

### Suggesting Features

Feature requests are welcome! Please provide:
- Clear description of the feature
- Use case / motivation
- Possible implementation approach (optional)

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting
5. Commit using conventional commits (`feat:`, `fix:`, `docs:`, etc.)
6. Push to your branch
7. Open a Pull Request

## 💻 Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/bdd-guardian.git
cd reqnroll-navigator

# Install dependencies
npm install

# Compile
npm run compile

# Watch mode (for development)
npm run watch

# Package extension
npm run package
```

## 📝 Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `style:` - Code style (formatting, semicolons, etc.)
- `refactor:` - Code refactoring
- `perf:` - Performance improvement
- `test:` - Adding tests
- `chore:` - Build process, dependencies, etc.

Examples:
```
feat: add support for SpecFlow projects
fix: correct regex parsing for verbatim strings
docs: update installation instructions
refactor: simplify provider detection logic
```

## 🏗️ Project Structure

```
src/
├── core/           # Core domain logic
│   ├── domain/     # Types and constants
│   ├── index/      # Workspace indexing
│   ├── matching/   # Step-to-binding matching
│   └── parsing/    # Gherkin and C# parsing
├── features/       # VS Code features
│   ├── navigation/ # Go to definition, CodeLens
│   ├── hovers/     # Hover information
│   └── diagnostics/# Problems panel
├── providers/      # Multi-provider architecture
│   └── bindings/   # Framework-specific providers
└── extension.ts    # Entry point
```

## ✅ Before Submitting

- [ ] Code compiles without errors (`npm run compile`)
- [ ] Linting passes (`npm run lint`)
- [ ] Changes are tested manually
- [ ] Documentation updated if needed
- [ ] Commit messages follow convention

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.
