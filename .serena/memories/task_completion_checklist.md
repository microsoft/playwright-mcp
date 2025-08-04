# Task Completion Checklist

## Required Checks After Code Implementation

1. **Run Lint**
   ```bash
   npm run lint
   ```
   - Confirm no ESLint errors
   - Confirm no TypeScript type errors

2. **Run Tests**
   ```bash
   npm run test
   ```
   - Confirm all tests pass
   - Add tests for new features

3. **Build Verification**
   ```bash
   npm run build
   ```
   - Confirm build succeeds
   - Confirm output to lib/ directory

## Pre-commit Checklist
- Copyright header included?
- No console.log statements?
- No floating promises (forgotten await)?
- Correct import order?
- Proper error handling?

## When Adding New Features
- Update README if needed with `npm run update-readme`
- Update type definitions in index.d.ts if needed
- Add samples to examples directory as appropriate