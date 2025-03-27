# GitHub Copilot Coding Standards

## Development Guidelines

- **VSCode API Usage**: Always utilize the VSCode API for file system operations and path handling rather than native Node.js modules
- **DOM Manipulation Best Practices**: When generating or modifying UI elements, implement proper DOM manipulation techniques instead of string-based HTML/CSS/JavaScript injection
  - Avoid using raw HTML/CSS/JavaScript strings
  - Do not introduce external DOM manipulation libraries (such as jsdom)
  - Leverage VSCode's WebView API for rendering complex UI components

## Architectural Principles

- Maintain separation of concerns between services, providers, and command handlers
- Follow TypeScript best practices with proper typing and interfaces
- Ensure backward compatibility with existing project structure and conventions
