# Playwright MCP — Batch Form Fill Instructions

## Tool: `browser_fill_form_batch`

You have access to a specialized tool named `browser_fill_form_batch` that fills
multiple form fields simultaneously in a single round-trip. This is **10x faster**
than filling fields one by one.

---

## When to Use `browser_fill_form_batch` (FAST PATH)

Use this tool whenever you encounter a form with **static, non-expanding fields**:

- Registration forms (name, email, password, phone)
- Login forms (username + password)
- Address forms (street, city, zip) — unless city/state depends on country
- Profile edit forms
- Search filters with multiple inputs
- Settings pages with multiple text fields

**Procedure:**
1. Take a snapshot of the page to identify all visible input fields
2. Collect ALL selectors and values into a single `actions` array
3. Execute `browser_fill_form_batch` once — all fields fill simultaneously
4. Take one final snapshot to verify

---

## When to Use Dependency Groups (SMART PATH)

Use the `groups` parameter when fields are **partially dynamic** — some fields
reveal or change based on other field values:

```json
{
  "groups": {
    "batch1": [
      { "selector": "#country", "value": "United States", "type": "select" }
    ],
    "batch2": [
      { "selector": "#state", "value": "New York", "type": "select" },
      { "selector": "#city", "value": "Brooklyn" }
    ]
  },
  "delayBetweenGroups": 300
}
```

Groups execute in alphabetical order. Fields within each group execute in parallel.

---

## When NOT to Use Batch Fill (SEQUENTIAL PATH)

Fall back to `browser_fill_form` or `browser_type` for:

- **Expanding fields**: clicking "Add another" buttons that create new inputs
- **Auto-complete fields**: inputs that show a dropdown of suggestions on type
- **Real-time validation**: fields that check server-side validity on each keystroke
- **CAPTCHA or challenge forms**: require specific interaction order
- **Multi-step wizards**: each step loads a new form page
- **Rich text editors**: contenteditable divs, WYSIWYG editors

---

## Decision Flowchart

```
Is this a form with multiple inputs?
├── YES → Are any fields expandable or dynamically created?
│   ├── YES → Do some static fields exist alongside dynamic ones?
│   │   ├── YES → Use `groups`: batch static fields, then handle dynamic ones sequentially
│   │   └── NO  → Use `browser_fill_form` or `browser_type` sequentially
│   └── NO  → Use `browser_fill_form_batch` with flat `actions` array
└── NO  → Use `browser_type` for the single field
```

---

## Strict Rules

1. **Never fill fields one by one** when `browser_fill_form_batch` is available
   and the form has 2+ static fields.
2. **Always prefer batch** unless you have a specific reason from the "When NOT
   to use" list above.
3. **Verify after batch fill** — take a single snapshot after all fields are
   filled to confirm correctness.
