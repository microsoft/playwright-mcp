# Code Style and Conventions

## TypeScript Configuration
- Strict mode enabled
- ESNext target
- NodeNext module system
- ESModuleInterop enabled

## ESLint Conventions
- **Indentation**: 2 spaces
- **Quotes**: Single quotes (')
- **Semicolons**: Required
- **Line endings**: Unix format (LF)
- **Object spacing**: Required ({ key: value })
- **Arrow function parentheses**: As needed (optional for single parameter)
- **Prefer const**: Use const for variables that aren't reassigned
- **no-console**: Error (console usage prohibited)

## File Structure
- All source files require Microsoft Copyright header
- TypeScript file extension: .ts
- Use .js extension in import statements (ESModules)

## Import Order
1. builtin (Node.js standard modules)
2. external (npm packages)
3. internal
4. parent/sibling
5. index
6. type imports

## Prohibited
- No var usage (only const/let)
- No floating promises (always await or .then/.catch)
- No unnecessary boolean comparisons