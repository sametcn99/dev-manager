import * as vscode from "vscode";
import { TaskCommandHandler } from "./commands/TaskCommandHandler";
import { ProjectTreeProvider } from "./providers/ProjectTreeProvider";
import { TasksTreeProvider } from "./providers/TasksTreeProvider";
import { TaskService } from "./services/TaskService";

export function activate(context: vscode.ExtensionContext) {
  // Initialize services
  const taskService = new TaskService();

  // Initialize providers
  const projectTreeProvider = new ProjectTreeProvider();
  const tasksTreeProvider = new TasksTreeProvider(taskService);

  // Register views
  vscode.window.registerTreeDataProvider(
    "devManagerProjects",
    projectTreeProvider,
  );
  vscode.window.registerTreeDataProvider("devManagerTasks", tasksTreeProvider);

  // Initialize command handlers with providers
  const taskCommandHandler = new TaskCommandHandler(
    context,
    projectTreeProvider,
    tasksTreeProvider,
  );

  // Register commands
  taskCommandHandler.registerCommands(context);
}

export function deactivate() {}
