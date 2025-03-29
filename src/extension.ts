import * as vscode from "vscode";
import { CommandHandlers } from "./commands/commandHandlers";
import { ProjectTreeProvider } from "./providers/ProjectTreeProvider";
import { TasksTreeProvider } from "./providers/TasksTreeProvider";
import { TaskService } from "./services/TaskService";

export function activate(context: vscode.ExtensionContext) {
  // Initialize providers
  const projectTreeProvider = new ProjectTreeProvider();
  const tasksTreeProvider = new TasksTreeProvider(new TaskService());

  // Initialize command handlers
  const commandHandlers = new CommandHandlers(context, projectTreeProvider);

  // Register views
  vscode.window.registerTreeDataProvider(
    "devManagerProjects",
    projectTreeProvider,
  );
  vscode.window.registerTreeDataProvider("devManagerTasks", tasksTreeProvider);

  // Watch for package.json changes to refresh projects
  const packageJsonWatcher =
    vscode.workspace.createFileSystemWatcher("**/package.json");
  packageJsonWatcher.onDidChange(() => projectTreeProvider.refresh());
  packageJsonWatcher.onDidCreate(() => projectTreeProvider.refresh());
  packageJsonWatcher.onDidDelete(() => projectTreeProvider.refresh());

  // Watch for tasks.json changes to refresh tasks
  const tasksJsonWatcher = vscode.workspace.createFileSystemWatcher(
    "**/.vscode/tasks.json",
  );
  tasksJsonWatcher.onDidChange(() => tasksTreeProvider.refresh());
  tasksJsonWatcher.onDidCreate(() => tasksTreeProvider.refresh());
  tasksJsonWatcher.onDidDelete(() => tasksTreeProvider.refresh());

  // Register the watchers for disposal
  context.subscriptions.push(packageJsonWatcher, tasksJsonWatcher);

  // Register refresh command for tasks view
  context.subscriptions.push(
    vscode.commands.registerCommand("dev-manager.refreshTasks", () => {
      tasksTreeProvider.refresh();
    }),
  );

  // Register all commands
  commandHandlers.registerAll(context);
}

export function deactivate() {}
