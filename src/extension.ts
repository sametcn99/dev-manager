import * as vscode from "vscode";
import { CommandHandlers } from "./commands/commandHandlers";
import { ProjectTreeProvider } from "./providers/ProjectTreeProvider";
import { PackageManagerService } from "./services/PackageManagerService";
import { TaskService } from "./services/TaskService";

export function activate(context: vscode.ExtensionContext) {
  const packageManagerService = new PackageManagerService();
  const taskService = new TaskService();
  const projectTreeProvider = new ProjectTreeProvider(taskService);

  // Track task execution to prevent unnecessary refreshes
  let isTaskExecuting = false;

  const commandHandlers = new CommandHandlers(
    projectTreeProvider,
    packageManagerService,
    taskService,
    context,
  );

  vscode.window.createTreeView("devManagerProjects", {
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

  // Refresh when tasks.json changes, but only if no task is currently executing
  tasksWatcher.onDidChange(() => {
    if (!isTaskExecuting) {
      projectTreeProvider.refresh();
    }
  });
  tasksWatcher.onDidCreate(() => projectTreeProvider.refresh());
  tasksWatcher.onDidDelete(() => projectTreeProvider.refresh());

  // Listen for task start/end events
  context.subscriptions.push(
    vscode.tasks.onDidStartTask(() => {
      isTaskExecuting = true;
    }),
    vscode.tasks.onDidEndTask(() => {
      // Use setTimeout to ensure any file changes have settled
      setTimeout(() => {
        isTaskExecuting = false;
      }, 300);
    }),
  );

  // Register the watchers to be disposed when extension is deactivated
  context.subscriptions.push(watcher, tasksWatcher);

  commandHandlers.registerCommands(context);
}

export function deactivate() {}
