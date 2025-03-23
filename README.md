# Dev Manager

A comprehensive Visual Studio Code extension that streamlines package management across multiple Node.js projects.

## 🌟 Features

### 📦 Package Manager Integration

- **Multi-Manager Support**: Works seamlessly with npm, yarn, pnpm, and bun
- **Easy Switching**: Change package managers for any project with one click
- **Automatic Detection**: Intelligently detects the appropriate package manager for each project
- **Lock File Management**: Handles different lock files (package-lock.json, yarn.lock, pnpm-lock.yaml, bun.lockb)

### 🗂️ Project Organization

- **Tree View**: Hierarchical view of all Node.js projects in your workspace
- **Visual Indicators**: Status icons showing dependency states and update availability
- **Project Grouping**: Organizes dependencies into production and development groups
- **Script Management**: Easy access and execution of npm scripts

### 📊 Dependency Management

- **Version Control**:
  - View current and latest versions
  - Check for available updates
  - Interactive version picker for upgrades
  - Smart version range handling (^, ~)
- **Bulk Operations**:
  - Install all dependencies across projects
  - Update all packages
  - Clean node_modules folders
- **Package Operations**:
  - Add new dependencies
  - Remove existing packages
  - Switch between production and development dependencies
  - View package details and descriptions

### 🔄 Update Management

- **Update Detection**: Automatically checks for outdated packages
- **Visual Feedback**: Clear indicators for packages with updates available
- **Smart Updates**: Respects semantic versioning when updating packages
- **Dependency Resolution**: Handles complex dependency trees

### ⚡ Quick Actions

- **One-Click Operations**: Install, update, or remove dependencies
- **Contextual Menus**: Right-click actions for common tasks
- **Bulk Commands**: Perform operations across multiple projects
- **Terminal Integration**: Automatic terminal handling for long-running tasks

### 🛠️ Developer Experience

- **Progress Indicators**: Visual feedback for long-running operations
- **Error Handling**: Clear error messages and recovery options
- **Project Refresh**: Manual and automatic refresh of project status
- **Workspace Integration**: Seamless integration with VS Code's workspace features

## 🚀 Getting Started

1. Install the extension from VS Code marketplace
2. Open a workspace containing Node.js projects
3. Look for the Dev Manager icon in the activity bar
4. Click to view all your projects and start managing them

## 💡 Tips

- Use the refresh button to update the project list after adding new projects
- Right-click on dependencies to see available actions
- Monitor update indicators to keep your packages up to date
- Use bulk operations to save time when managing multiple projects

## ⚙️ Commands

All commands are accessible through:

- Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
- Context menus in the tree view
- Icons in the view header

Key commands include:

- `Dev Manager: Refresh Projects`
- `Dev Manager: Install All Dependencies`
- `Dev Manager: Update All Dependencies`
- `Dev Manager: Clean node_modules`
- `Dev Manager: Add Dependency`
- `Dev Manager: Change Package Manager`
