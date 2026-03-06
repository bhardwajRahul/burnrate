# Contributing to Burnrate

Thank you for your interest in contributing to **Burnrate**! This document will help you get started and ensure your contributions align with the project's standards.

---

## 1. Welcome & Overview

**Burnrate** is a privacy-first, local-only credit card spend analytics application. Your financial data never leaves your machine — no cloud, no servers, no tracking. The app parses PDF statements from multiple Indian banks, categorizes transactions, and provides rich analytics — all running entirely on your laptop.

We welcome contributions from developers, designers, and anyone passionate about privacy-focused personal finance tools. Whether you're fixing a bug, adding a new bank parser, improving the UI, or enhancing documentation, your help makes Burnrate better for everyone.

For a high-level overview of features, installation options, and project structure, see the [README](README.md).

---

## 2. Spec-Driven Development

Burnrate is an **AI-coded project** that follows **spec-driven development**. This means we plan before we code.

### Core Principle

**All new features and significant changes MUST have a spec/plan document BEFORE implementation.**

PRs without specs for non-trivial changes will not be accepted. This ensures:

- Clear alignment on scope and design
- Easier code review and maintenance
- Better collaboration with AI coding assistants
- Consistent architecture across the codebase

### Where to Put Specs

- Create specs in the **`docs/plans/`** directory
- Use descriptive filenames (e.g., `docs/plans/new-bank-parser-sbi.md`, `docs/plans/transaction-notes-feature.md`)

### Spec Contents

Every spec must include:

| Section | Description |
|---------|-------------|
| **Feature description** | What the feature does and why it's needed |
| **API contracts** | Request/response shapes, status codes, error formats |
| **Data model changes** | Schema changes, migrations, relationships |
| **Edge cases** | Error conditions, boundary values, failure modes |
| **UI mockups** | (If applicable) Wireframes or descriptions of UI changes |

### Project Documents to Reference

Before implementing, read and reference these documents:

| Document | Purpose |
|----------|---------|
| [docs/CONSTITUTION.md](docs/CONSTITUTION.md) | Project guidelines, code constraints, security standards |
| [docs/requirements.md](docs/requirements.md) | Functional and non-functional requirements |
| [docs/architecture.md](docs/architecture.md) | System architecture, data models, API docs, diagrams |
| [docs/plans/](docs/plans/) | Feature plans for existing and proposed features |

---

## 3. Getting Started

### Prerequisites

- **Python 3.12+** (backend)
- **Node.js 18+** (frontend)
- **Rust** (for Tauri desktop builds)
- **Docker** (optional, for containerized development)

### Clone the Repository

```bash
git clone https://github.com/pratik1235/burnrate.git
cd burnrate
```

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

The API will be available at `http://127.0.0.1:8000`.

### Frontend Setup

In a separate terminal:

```bash
cd frontend-neopop
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`.

### Running Tests

**Backend (pytest):**

```bash
cd backend
pytest ../tests -v
```

**Frontend (Storybook for components):**

```bash
cd frontend-neopop
npm run storybook
```

**End-to-end (Playwright):**

```bash
# See tests/test_browser.py for Playwright setup
```

### Docker

For a fully containerized setup, create a `docker-compose.yml` per the [Docker installation guide](docs/docker-installation.md), then run:

```bash
docker compose up
```

Or use `docker run` for a quick start (see the guide for the full command).

---

## 4. Code Standards

### Frontend

- **NeoPOP design system** — All UI MUST use `@cred/neopop-web` components (`Typography`, `Button`, `ElevatedCard`, `Tag`, `InputField`, `Row`, `Column`, etc.)
- **Icons** — Use `lucide-react` only; no other icon libraries
- **Styling** — `styled-components` with NeoPOP tokens; dark theme with black backgrounds
- **TypeScript** — Strict mode enabled; proper types for all props and state
- **React patterns** — `useEffect` cleanup for subscriptions/async work; no `dangerouslySetInnerHTML`

### Backend

- **FastAPI** — Proper dependency injection via `Depends()`, Pydantic models for validation
- **SQLAlchemy 2.x** — ORM for all database access
- **Parameterized queries only** — Never concatenate user input into raw SQL
- **Type hints** — Python type hints on all public functions

### Security

Follow the security guidelines in [docs/CONSTITUTION.md](docs/CONSTITUTION.md):

- No hardcoded secrets or API keys
- Path traversal prevention for file operations
- Input validation and sanitization
- LIKE wildcard escaping for search queries
- File upload size limits and filename sanitization

### Privacy

- **No external network requests** — The app does not call external APIs
- **No telemetry** — No usage tracking, crash reporting, or analytics
- All data stays on the user's machine

---

## 5. How to Contribute

### Workflow

1. **Fork** the repository on GitHub
2. **Create a feature branch** from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Write the spec first** (for non-trivial changes) — Add a plan in `docs/plans/`
4. **Implement** the feature following the spec
5. **Add tests** — Integration tests for new features; update existing tests as needed
6. **Submit a PR** with a description that references the spec

### PR Guidelines

- **Title** — Clear, descriptive (e.g., "Add SBI bank parser", "Fix transaction filter bug")
- **Description** — Link to the spec document for non-trivial changes; summarize changes
- **Tests** — Ensure all tests pass; new code should have test coverage

### PR Review Process

- Maintainers will review your PR for adherence to CONSTITUTION, requirements, and code quality
- Address feedback promptly
- Once approved, a maintainer will merge your PR

---

## 6. Types of Contributions Welcome

| Type | Description |
|------|-------------|
| **New bank parsers** | Add support for parsing PDF statements from banks not yet supported |
| **UI improvements** | Enhance the frontend using NeoPOP design system components |
| **Bug fixes** | Fix issues reported in GitHub Issues |
| **Documentation** | Improve README, docs, inline comments, or API documentation |
| **Test coverage** | Add or improve tests for backend, frontend, or parsers |
| **Performance** | Optimize queries, reduce re-renders, improve statement processing |

---

## 7. Adding a New Bank Parser

Adding support for a new bank is one of the most valuable contributions. Follow these steps:

### Step 1: Create a Parser Class

Create a new file in `backend/parsers/` (e.g., `sbi.py`) that extends `BaseParser`:

```python
from backend.parsers.base import BaseParser, ParsedStatement, ParsedTransaction

class SBIParser(BaseParser):
    """Parser for SBI credit card statements."""

    def parse(self, pdf_path: str) -> ParsedStatement:
        # Use pdfplumber to extract text/tables
        # Return ParsedStatement with bank, period_start, period_end,
        # transactions (list of ParsedTransaction), card_last4,
        # total_amount_due, credit_limit
        ...
```

### Step 2: Implement the `parse` Method

- Use `pdfplumber` to open the PDF and extract text/tables
- Parse transaction lines (date, merchant, amount, type: debit/credit, description)
- Extract metadata: billing period, card last4, total amount due, credit limit
- Return a `ParsedStatement` with all fields populated

### Step 3: Register in PARSERS Dict

In `backend/services/statement_processor.py`, add your parser to the `PARSERS` dict:

```python
from backend.parsers.sbi import SBIParser

PARSERS: Dict[str, Type] = {
    "hdfc": HDFCParser,
    "icici": ICICIParser,
    "axis": AxisParser,
    "federal": FederalBankParser,
    "indian_bank": IndianBankParser,
    "sbi": SBIParser,  # Add your parser
}
```

### Step 4: Add Detector Logic

In `backend/parsers/detector.py`, add filename patterns and PDF content checks so the detector can identify your bank:

```python
# Filename check
if "sbi" in filename or "sbi card" in filename:
    return "sbi"

# PDF content check (first page text)
if re.search(r"\bsbi\b", text_lower) or "sbi card" in text_lower:
    return "sbi"
```

### Step 5: Add Tests with Fixture PDFs

1. Add a sample statement PDF to `tests/fixtures/` (e.g., `sbi_1234.pdf`) — **redact or anonymize sensitive data**
2. Add a test class in `tests/test_parsers.py`:

```python
class TestSBIParser:
    @pytest.fixture(autouse=True)
    def parse(self, tmp_path):
        src = str(FIXTURES / "sbi_1234.pdf")
        unlocked = _unlock(src, "sbi")  # If encrypted
        self.result = SBIParser().parse(unlocked)
        yield
        if unlocked != src:
            Path(unlocked).unlink(missing_ok=True)

    def test_card_detected(self):
        assert self.result.card_last4 == "1234"

    def test_period(self):
        assert self.result.period_start is not None
        assert self.result.period_end is not None

    def test_transaction_count(self):
        assert len(self.result.transactions) > 0
    # ... more assertions
```

### Step 6: PDF Unlock (if applicable)

If the bank uses password-protected PDFs, add password generation logic in `backend/services/pdf_unlock.py` following the bank-specific format (e.g., DDMM+NAME4, NAME4+DDMM).

---

## 8. Reporting Issues

### Bug Reports

When reporting a bug, please include:

- **Description** — What happened vs. what you expected
- **Steps to reproduce** — Minimal steps to trigger the bug
- **Environment** — OS, Python/Node versions, installation method (Docker, Homebrew, from source)
- **Logs** — Relevant error messages or stack traces (redact any sensitive data)

### Feature Requests

For feature requests:

- **Use case** — What problem does this solve?
- **Proposed solution** — How would it work?
- **Alternatives** — Other approaches you considered

You can use the issue templates if available, or open a new issue with the appropriate label.

---

## 9. Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for everyone. We expect all contributors to:

- **Be respectful** — Treat others with respect and kindness
- **Be collaborative** — Work constructively with maintainers and other contributors
- **Be professional** — Focus on the code and the project, not personal attacks
- **Respect privacy** — Never request or share user data, credentials, or sensitive information

### Unacceptable Behavior

Harassment, trolling, discriminatory language, or any conduct that makes others feel unwelcome is not tolerated. Violations may result in removal from the project.

---

## 10. License

By contributing to Burnrate, you agree that your contributions will be licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE) file for details.

---

Thank you for contributing to Burnrate. Your efforts help make privacy-first personal finance accessible to everyone.
