import * as vscode from "vscode";
import { ProjectTreeProvider } from "./providers/ProjectTreeProvider";
import { PackageManagerService } from "./services/PackageManagerService";
import { TaskService } from "./services/TaskService";
import { CommandHandlers } from "./commands/commandHandlers";
import { TaskCommandHandler } from "./commands/TaskCommandHandler";

export function activate(context: vscode.ExtensionContext) {
  const packageManagerService = new PackageManagerService();
  const taskService = new TaskService();
  const projectTreeProvider = new ProjectTreeProvider(taskService);
  const commandHandlers = new CommandHandlers(
    projectTreeProvider,
    packageManagerService,
    taskService,
    context,
  );

  const treeView = vscode.window.createTreeView("devManagerProjects", {
    treeDataProvider: projectTreeProvider,
  });

  // Create a file system watcher for package.json files
  const watcher = vscode.workspace.createFileSystemWatcher(
    "**/package.json",
    false,
    false,
    false,
  );

  // Refresh projects when package.json changes
  watcher.onDidChange(() => projectTreeProvider.refresh());
  watcher.onDidCreate(() => projectTreeProvider.refresh());
  watcher.onDidDelete(() => projectTreeProvider.refresh());

  // Create a file system watcher for tasks.json files
  const tasksWatcher = vscode.workspace.createFileSystemWatcher(
    "**/.vscode/tasks.json",
    false,
    false,
    false,
  );

  // Refresh when tasks.json changes
  tasksWatcher.onDidChange(() => projectTreeProvider.refresh());
  tasksWatcher.onDidCreate(() => projectTreeProvider.refresh());
  tasksWatcher.onDidDelete(() => projectTreeProvider.refresh());

  // Register the watchers to be disposed when extension is deactivated
  context.subscriptions.push(watcher, tasksWatcher);

  commandHandlers.registerCommands(context);
}

export function deactivate() {}
