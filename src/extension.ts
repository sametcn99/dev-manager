import * as vscode from "vscode";
import { ProjectTreeProvider } from "./providers/ProjectTreeProvider";
import { PackageManagerService } from "./services/PackageManagerService";
import { CommandHandlers } from "./commands/commandHandlers";

export function activate(context: vscode.ExtensionContext) {
  const packageManagerService = new PackageManagerService();
  const projectTreeProvider = new ProjectTreeProvider();
  const commandHandlers = new CommandHandlers(
    projectTreeProvider,
    packageManagerService,
  );

  const treeView = vscode.window.createTreeView("devManagerProjects", {
    treeDataProvider: projectTreeProvider,
  });

  commandHandlers.registerCommands(context);
}

export function deactivate() {}
