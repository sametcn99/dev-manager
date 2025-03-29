# GitHub Copilot Coding Standards

## Development Guidelines

- **VSCode API Usage**: Always utilize the VSCode API for file system operations and path handling rather than native Node.js modules

  - Use `vscode.workspace.fs` instead of `fs` module
  - Use `vscode.Uri` for path manipulation instead of `path` module
  - Leverage `vscode.commands` for command registration and execution
  - Utilize `vscode.window` for UI interactions
  - Use `vscode.workspace.getConfiguration()` for accessing extension settings
  - Implement proper extension activation events in `package.json`

- **DOM Manipulation Best Practices**: When generating or modifying UI elements, implement proper DOM manipulation techniques instead of string-based HTML/CSS/JavaScript injection

  - Avoid using raw HTML/CSS/JavaScript strings
  - Do not introduce external DOM manipulation libraries (such as jsdom)
  - Leverage VSCode's WebView API for rendering complex UI components
  - Use `getNonce()` for Content Security Policy implementation
  - Implement proper message passing between extension and webviews
  - Follow VSCode's theming guidelines for consistent UI appearance
  - Use CSS variables provided by VSCode for theme compatibility

- **Error Handling**:

  - Use try/catch blocks for operations that might fail
  - Log errors with appropriate levels (error, warning, info)
  - Provide meaningful error messages to users
  - Implement graceful degradation when features cannot function
  - Use telemetry for tracking non-sensitive error information (with user consent)
  - Add contextual information to error messages for easier debugging
  - Return appropriate status codes and error objects from APIs

- **Performance Considerations**:
  - Avoid blocking the main thread with long-running operations
  - Use async/await patterns for asynchronous operations
  - Implement proper disposal of resources and event listeners
  - Consider throttling or debouncing for frequently triggered events
  - Use `Promise.all()` for parallel asynchronous operations
  - Implement caching strategies for expensive operations
  - Consider using web workers for CPU-intensive tasks in WebViews
  - Lazy-load components and resources when possible

## Code Organization

- **Project Structure**:

  - Follow the standard VSCode extension project structure
  - Organize code by feature or domain rather than by file type
  - Keep related functionality close together
  - Use barrel files (index.ts) for cleaner imports
  - Place tests alongside source files or in a parallel directory structure

- **Module Design**:
  - Create clear interfaces between subsystems
  - Design for extensibility while maintaining simplicity
  - Follow the single responsibility principle
  - Use dependency injection to facilitate testing
  - Create services for reusable functionality
  - Implement factories for complex object creation

## Architectural Principles

- Maintain separation of concerns between services, providers, and command handlers
- Follow TypeScript best practices with proper typing and interfaces
- Ensure backward compatibility with existing project structure and conventions
- Implement the Command pattern for all user-initiated actions
- Use dependency injection where appropriate to improve testability
- Prefer composition over inheritance for code reuse
- Follow the principle of least privilege when accessing resources
- Implement the Observer pattern for event-driven architecture
- Use the Strategy pattern for algorithms that may vary
- Implement the Repository pattern for data access abstraction
- Follow SOLID principles throughout the codebase

## Security Best Practices

- **Input Validation**:

  - Validate all user inputs before processing
  - Sanitize data displayed in WebViews
  - Implement proper Content Security Policy in WebViews
  - Use parameterized commands to prevent command injection

- **Data Handling**:
  - Store sensitive data using VSCode's SecretStorage API
  - Never log sensitive information
  - Implement proper data encryption for stored credentials
  - Follow the principle of least privilege for data access

## Documentation Standards

- **Code Documentation**:

  - Use JSDoc comments for all public APIs
  - Document parameters, return values, and exceptions
  - Include examples for complex functionality
  - Keep documentation up-to-date with code changes

- **User Documentation**:
  - Provide clear README with installation and usage instructions
  - Include screenshots or GIFs for visual features
  - Document all commands and settings
  - Create a CHANGELOG to track version changes

## Version Control Practices

- Use semantic versioning (MAJOR.MINOR.PATCH)
- Write meaningful commit messages following conventional commits
- Create feature branches for new development
- Use pull requests for code review
- Squash commits before merging to maintain a clean history
- Tag releases in the repository

## Remember

- Always write clean, maintainable, and well-documented code
- Follow the project's existing coding style and conventions
- Always write comments in english
- Always check for eslint errors and warnings by eslint.config.mjs
- Document public APIs with JSDoc comments
- Keep functions small and focused on a single responsibility
- Use meaningful variable and function names
- Avoid magic numbers and strings
- Write code for readability first, optimization second
- Consider accessibility in all UI implementations
- Implement proper internationalization where needed

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
- [VSCode Extension Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [VSCode Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- [SOLID Principles](https://en.wikipedia.org/wiki/SOLID)
- [VS Code Extension Samples](https://github.com/microsoft/vscode-extension-samples)
- [VS Code Extension API](https://code.visualstudio.com/api/references/vscode-api)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
- [Web Accessibility Initiative (WAI)](https://www.w3.org/WAI/)
- [A11Y Project](https://www.a11yproject.com/)
- [VS Code Testing API](https://code.visualstudio.com/api/references/vscode-api#testing)
- [Internationalization in VS Code](https://code.visualstudio.com/api/references/extension-manifest#localizations)
- [VS Code Extension Marketplace](https://marketplace.visualstudio.com/vscode)
- [Security Best Practices for VS Code Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension#security)
- [Domain-Driven Design (DDD)](https://domainlanguage.com/ddd/)
- [The Twelve-Factor App](https://12factor.net/)
- [ESLint Rules](https://eslint.org/docs/rules/)
- [TypeScript ESLint](https://typescript-eslint.io/rules/)
- [Front-End Performance Checklist](https://github.com/thedaviddias/Front-End-Performance-Checklist)
- [Web Components Best Practices](https://developers.google.com/web/fundamentals/web-components/best-practices)
- [Microsoft Graph JavaScript SDK](https://learn.microsoft.com/en-us/graph/sdks/choose-authentication-providers?tabs=Javascript)
- [Chai Assertion Library](https://www.chaijs.com/)
- [Visual Studio Code API Cheatsheet](https://code.visualstudio.com/api/references/commands)
- [VS Code WebView API Sample](https://github.com/microsoft/vscode-extension-samples/tree/main/webview-sample)
- [VS Code Language Server Protocol](https://microsoft.github.io/language-server-protocol/)
- [VS Code Debug Adapter Protocol](https://microsoft.github.io/debug-adapter-protocol/)
- [VS Code Custom Editor API](https://code.visualstudio.com/api/extension-guides/custom-editors)
- [VS Code Tree View API](https://code.visualstudio.com/api/extension-guides/tree-view)
- [VS Code Task Provider](https://code.visualstudio.com/api/extension-guides/task-provider)
- [VS Code Authentication API](https://code.visualstudio.com/api/references/vscode-api#authentication)
- [VS Code Notebook API](https://code.visualstudio.com/api/references/vscode-api#notebooks)
- [Accessibility in VS Code](https://code.visualstudio.com/docs/editor/accessibility)
- [Publishing Extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Bundling Extensions](https://code.visualstudio.com/api/working-with-extensions/bundling-extension)
- [Testing VS Code Extensions](https://code.visualstudio.com/api/working-with-extensions/testing-extension)
- [Package.json Contribution Points](https://code.visualstudio.com/api/references/contribution-points)
- [VS Code Command API](https://code.visualstudio.com/api/references/commands)
- [RxJS Documentation](https://rxjs.dev/guide/overview)
- [Webpack Configuration for VS Code Extensions](https://github.com/microsoft/vscode-extension-samples/tree/main/webpack-sample)
- [esbuild for VS Code Extensions](https://github.com/microsoft/vscode-extension-samples/tree/main/esbuild-sample)
- [Testing VS Code Extensions with Jest](https://github.com/microsoft/vscode-extension-samples/tree/main/test-jest-sample)
- [VS Code Remote Development](https://code.visualstudio.com/docs/remote/remote-overview)
- [VS Code Remote Extension Architecture](https://code.visualstudio.com/api/advanced-topics/remote-extensions)
- [VS Code Extension Secrets API](https://code.visualstudio.com/api/references/vscode-api#SecretStorage)
- [VS Code Extension Activation Events](https://code.visualstudio.com/api/references/activation-events)
- [VS Code Extension Terminal API](https://code.visualstudio.com/api/references/vscode-api#Terminal)
- [Semantic Versioning](https://semver.org/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Storybook for UI Component Development](https://storybook.js.org/)
- [MDN Web Docs](https://developer.mozilla.org/en-US/)
- [Web.dev Performance](https://web.dev/performance/)
- [The State of JavaScript](https://stateofjs.com/)
- [The State of TypeScript](https://2020.stateofjs.com/en-US/technologies/typescript/)
- [Web Components](https://www.webcomponents.org/)
- [VS Code Extension Context](https://code.visualstudio.com/api/references/vscode-api#ExtensionContext)
- [VS Code Extension Host](https://code.visualstudio.com/api/advanced-topics/extension-host)
- [VS Code Virtual Documents](https://code.visualstudio.com/api/extension-guides/virtual-documents)
- [VS Code Extension Samples GitHub](https://github.com/microsoft/vscode-extension-samples)
- [TypeScript Programming with VS Code](https://code.visualstudio.com/docs/typescript/typescript-tutorial)
- [VS Code API GitHub](https://github.com/microsoft/vscode/tree/main/src/vs/vscode.d.ts)
- [Electron Documentation](https://www.electronjs.org/docs)
- [TypeDoc - Documentation Generator for TypeScript](https://typedoc.org/)
- [npm Documentation](https://docs.npmjs.com/)
- [VSCode Theme Color Reference](https://code.visualstudio.com/api/references/theme-color)
- [UI/UX Design Principles](https://www.nngroup.com/articles/ten-usability-heuristics/)
- [Design System Guidelines](https://designsystem.digital.gov/)
- [Inclusive Design Principles](https://inclusivedesignprinciples.org/)
- [Web Content Accessibility Guidelines (WCAG)](https://www.w3.org/WAI/standards-guidelines/wcag/)
- [Typescript Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html)
- [TypeScript Advanced Types](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html)
- [JavaScript Promises](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises)
- [JavaScript Async/Await](https://developer.mozilla.org/en-US/docs/Learn/JavaScript/Asynchronous/Async_await)
- [VS Code Integration Testing](https://code.visualstudio.com/api/working-with-extensions/testing-extension#integration-test-runner)
- [VS Code API Events](https://code.visualstudio.com/api/references/vscode-api#Events)
- [VS Code API Languages](https://code.visualstudio.com/api/references/vscode-api#languages)
- [VS Code API Window](https://code.visualstudio.com/api/references/vscode-api#window)
- [VS Code API Workspace](https://code.visualstudio.com/api/references/vscode-api#workspace)
- [Performance Profiling for VS Code Extensions](https://code.visualstudio.com/api/advanced-topics/profiling)
