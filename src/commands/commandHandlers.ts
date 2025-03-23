import * as vscode from "vscode";
import { ProjectTreeProvider } from "../providers/ProjectTreeProvider";
import { ProjectTreeItem } from "../views/TreeItems";
import { PackageManagerService } from "../services/PackageManagerService";

export class CommandHandlers {
  constructor(
    private projectTreeProvider: ProjectTreeProvider,
    private packageManagerService: PackageManagerService,
  ) {}

  public registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand("dev-manager.refreshProjects", () => {
        this.projectTreeProvider.refresh();
      }),

      vscode.commands.registerCommand(
        "dev-manager.changePackageManager",
        async (item: ProjectTreeItem) => {
          if (!item) {
            return;
          }

          const packageManagers: { label: string; value: PackageManager }[] = [
            { label: "npm", value: "npm" },
            { label: "yarn", value: "yarn" },
            { label: "pnpm", value: "pnpm" },
            { label: "bun", value: "bun" },
          ];

          const selected = await vscode.window.showQuickPick(
            packageManagers.map((pm) => ({
              label: pm.label,
              description:
                item.packageManager === pm.value ? "(current)" : undefined,
              value: pm.value,
            })),
            {
              placeHolder: "Select package manager",
              title: `Change package manager for ${item.label}`,
            },
          );

          if (selected) {
            await this.projectTreeProvider.changePackageManager(
              item,
              selected.value,
            );
            vscode.window.showInformationMessage(
              `Changed package manager to ${selected.label} for ${item.label}`,
            );
          }
        },
      ),

      vscode.commands.registerCommand(
        "dev-manager.installDependencies",
        async (item: ProjectTreeItem) => {
          if (!item) {
            return;
          }

          const terminal = vscode.window.createTerminal("Dev Manager");
          terminal.show();
          const project = (
            await this.projectTreeProvider.getAllProjects()
          ).find((p) => p.path === item.path);
          if (project) {
            const installCmd = this.packageManagerService.getCommand(
              project.packageManager,
              "install",
            );
            terminal.sendText(`cd "${project.path}" && ${installCmd}`);
          }
        },
      ),

      vscode.commands.registerCommand(
        "dev-manager.updateDependencies",
        async (item: ProjectTreeItem) => {
          if (!item) {
            return;
          }

          const terminal = vscode.window.createTerminal("Dev Manager");
          terminal.show();
          const project = (
            await this.projectTreeProvider.getAllProjects()
          ).find((p) => p.path === item.path);
          if (project) {
            const updateCmd = this.packageManagerService.getCommand(
              project.packageManager,
              "update",
            );
            terminal.sendText(`cd "${project.path}" && ${updateCmd}`);
          }
        },
      ),

      vscode.commands.registerCommand(
        "dev-manager.cleanNodeModules",
        async (item: ProjectTreeItem) => {
          if (!item) {
            return;
          }

          const nodeModulesUri = vscode.Uri.joinPath(
            vscode.Uri.file(item.path),
            "node_modules",
          );
          try {
            await vscode.workspace.fs.delete(nodeModulesUri, {
              recursive: true,
            });
            vscode.window.showInformationMessage(
              `Cleaned node_modules in ${item.label}`,
            );
            this.projectTreeProvider.refresh();
          } catch (error) {
            vscode.window.showErrorMessage(
              `Failed to clean node_modules in ${item.label}: ${error}`,
            );
          }
        },
      ),

      vscode.commands.registerCommand(
        "dev-manager.installAllDependencies",
        async () => {
          const projects = await this.projectTreeProvider.getAllProjects();
          if (projects.length === 0) {
            vscode.window.showInformationMessage(
              "No Node.js projects found in workspace",
            );
            return;
          }

          const terminal = vscode.window.createTerminal(
            "Dev Manager - Bulk Install",
          );
          terminal.show();
          for (const project of projects) {
            const installCmd = this.packageManagerService.getCommand(
              project.packageManager,
              "install",
            );
            terminal.sendText(
              `cd "${project.path}" && echo "Installing dependencies for ${project.name}..." && ${installCmd}`,
            );
          }
          vscode.window.showInformationMessage(
            `Installing dependencies for ${projects.length} projects...`,
          );
        },
      ),

      vscode.commands.registerCommand(
        "dev-manager.updateAllDependencies",
        async () => {
          const projects = await this.projectTreeProvider.getAllProjects();
          if (projects.length === 0) {
            vscode.window.showInformationMessage(
              "No Node.js projects found in workspace",
            );
            return;
          }

          const terminal = vscode.window.createTerminal(
            "Dev Manager - Bulk Update",
          );
          terminal.show();
          for (const project of projects) {
            const updateCmd = this.packageManagerService.getCommand(
              project.packageManager,
              "update",
            );
            terminal.sendText(
              `cd "${project.path}" && echo "Updating dependencies for ${project.name}..." && ${updateCmd}`,
            );
          }
          vscode.window.showInformationMessage(
            `Updating dependencies for ${projects.length} projects...`,
          );
        },
      ),
    );
  }
}
