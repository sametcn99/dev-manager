import * as vscode from "vscode";
import { CommandHandlers } from "./commands/commandHandlers";
import { ProjectTreeProvider } from "./providers/ProjectTreeProvider";
import { TasksTreeProvider } from "./providers/TasksTreeProvider";
import { TaskService } from "./services/TaskService";

export function activate(context: vscode.ExtensionContext) {
  // Initialize providers
  const projectTreeProvider = new ProjectTreeProvider();

  // Initialize command handlers
  const commandHandlers = new CommandHandlers(context, projectTreeProvider);

  // Register views
  vscode.window.registerTreeDataProvider(
    "devManagerProjects",
    projectTreeProvider,
  );
  vscode.window.registerTreeDataProvider(
    "devManagerTasks",
    new TasksTreeProvider(new TaskService()),
  );

  // Register all commands
  commandHandlers.registerAll(context);
}

export function deactivate() {}
