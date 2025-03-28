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

## Remember

- Always write clean, maintainable, and well-documented code
- Follow the project's existing coding style and conventions
- Always write comments in english
- Always check for eslint errors and warnings by eslint.config.mjs

## Additional Resources

You can refer to the following resources for more information on coding standards and best practices:

- [VSCode API Documentation](https://code.visualstudio.com/api)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [JavaScript Standard Style](https://standardjs.com/)
- [Node.js Documentation](https://nodejs.org/en/docs/)
- [WebView API Documentation](https://code.visualstudio.com/api/extensionAPI/vscode-api#Webview)
- [JavaScript Best Practices](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Best_practices)
- [TypeScript Best Practices](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)
- [JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html)
- [Refactoring Guru](https://refactoring.guru/)
- [Clean Code](https://www.oreilly.com/library/view/clean-code-a/9780136083238/)
- [Refactoring Patterns](https://refactoring.guru/design-patterns)
- [JavaScript Design Patterns](https://addyosmani.com/resources/essentialjsdesignpatterns/book/)
- [Your First Extension](https://code.visualstudio.com/api/get-started/your-first-extension)
- [Extension Anatomy](https://code.visualstudio.com/api/get-started/extension-anatomy)
- [Extension Development](https://code.visualstudio.com/api/get-started/extension-development)
