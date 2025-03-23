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

  // Register the watcher to be disposed when extension is deactivated
  context.subscriptions.push(watcher);

  commandHandlers.registerCommands(context);
}

export function deactivate() {}
