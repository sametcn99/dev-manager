import * as vscode from "vscode";
import { ProjectTreeProvider } from "../providers/ProjectTreeProvider";
import {
  ProjectTreeItem,
  DependencyTreeItem,
  DependencyGroupTreeItem,
} from "../views/TreeItems";
import { PackageManagerService } from "../services/PackageManagerService";

export class CommandHandlers {
  constructor(
    private projectTreeProvider: ProjectTreeProvider,
    private packageManagerService: PackageManagerService,
  ) {}

  public registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dev-manager.refreshProjects",
        async () => {
          this.projectTreeProvider.refresh();
        },
      ),

      vscode.commands.registerCommand(
        "dev-manager.showPackageManagerPicker",
        async (info: {
          path: string;
          current: PackageManager;
          available: PackageManager[];
        }) => {
          const items = info.available.map((pm) => ({
            label: pm,
            description: pm === info.current ? "Current" : undefined,
            picked: pm === info.current,
          }));

          const selected = await vscode.window.showQuickPick(items, {
            title: "Select Package Manager",
            placeHolder: `Current: ${info.current}`,
          });

          if (selected && selected.label !== info.current) {
            // Reuse existing changePackageManager command
            await vscode.commands.executeCommand(
              "dev-manager.changePackageManager",
              {
                path: info.path,
                packageManager: selected.label as PackageManager,
              },
            );
          }
        },
      ),

      vscode.commands.registerCommand(
        "dev-manager.changePackageManager",
        async (info: { path: string; packageManager: PackageManager }) => {
          const projectUri = vscode.Uri.file(info.path);
          const currentLockFile =
            await this.packageManagerService.getLockFile(projectUri);

          const message = currentLockFile
            ? `This will delete node_modules and ${currentLockFile}. Are you sure you want to switch to ${info.packageManager}?`
            : `This will delete node_modules. Are you sure you want to switch to ${info.packageManager}?`;

          const response = await vscode.window.showWarningMessage(
            message,
            { modal: true },
            "Yes",
            "No",
          );

          if (response !== "Yes") {
            return;
          }

          // Show progress during the cleanup and reinstallation
          await vscode.window.withProgress(
            {
              location: vscode.ProgressLocation.Notification,
              title: `Switching to ${info.packageManager}...`,
              cancellable: false,
            },
            async (progress) => {
              try {
                progress.report({ message: "Cleaning up..." });
                await this.packageManagerService.cleanupBeforePackageManagerChange(
                  projectUri,
                );

                // Update the package manager in the tree
                await this.projectTreeProvider.changePackageManager(info);

                progress.report({ message: "Installing dependencies..." });
                const terminal = vscode.window.createTerminal(
                  `Dev Manager - ${info.packageManager} Install`,
                );
                terminal.show();
                const installCmd = this.packageManagerService.getCommand(
                  info.packageManager,
                  "install",
                );
                terminal.sendText(`cd "${info.path}" && ${installCmd}`);

                vscode.window.showInformationMessage(
                  `Successfully switched to ${info.packageManager}`,
                );
              } catch (error) {
                vscode.window.showErrorMessage(
                  `Failed to switch package manager: ${error}`,
                );
              }
            },
          );
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

      vscode.commands.registerCommand(
        "dev-manager.showDependencyVersionPicker",
        async (info: {
          packageName: string;
          projectPath: string;
          isDev: boolean;
          currentVersion?: string;
          versionRange: string;
          availableVersions?: string[];
        }) => {
          const details = await this.packageManagerService.getDependencyDetails(
            info.projectPath,
            info.packageName,
          );

          if (!details?.availableVersions?.length) {
            vscode.window.showErrorMessage(
              `Failed to fetch versions for ${info.packageName}`,
            );
            return;
          }

          const items: vscode.QuickPickItem[] = details.availableVersions.map(
            (version) => ({
              label: version,
              description:
                version === details.currentVersion
                  ? "Current"
                  : version === details.latestVersion
                    ? "Latest"
                    : undefined,
              detail:
                version === details.currentVersion
                  ? "Currently installed version"
                  : version === details.latestVersion
                    ? "Latest available version"
                    : undefined,
            }),
          );

          const selected = await vscode.window.showQuickPick(items, {
            title: `Select Version for ${info.packageName}`,
            placeHolder: `Current: ${info.currentVersion || "Not installed"}, Range: ${info.versionRange}`,
          });

          if (selected) {
            try {
              const prefix = info.versionRange.startsWith("^")
                ? "^"
                : info.versionRange.startsWith("~")
                  ? "~"
                  : "";
              const newVersion = `${prefix}${selected.label}`;

              // Use VS Code's built-in npm commands to install the specific version
              await vscode.commands.executeCommand(
                "npm.installSpecific",
                info.packageName,
                newVersion,
                info.projectPath,
                info.isDev,
              );
              this.projectTreeProvider.refresh();
            } catch (error) {
              vscode.window.showErrorMessage(
                `Failed to update ${info.packageName}: ${error}`,
              );
            }
          }
        },
      ),

      vscode.commands.registerCommand(
        "dev-manager.addDependency",
        async (element: DependencyGroupTreeItem) => {
          if (!element?.projectPath) {
            return;
          }

          const isDev = element.label === "Dev Dependencies";

          // Show input box for package name
          const packageName = await vscode.window.showInputBox({
            placeHolder: "Enter package name",
            prompt: `Add ${isDev ? "development" : ""} dependency`,
          });

          if (!packageName) {
            return;
          }

          // Get available versions
          const versions =
            await this.packageManagerService.getPackageVersions(packageName);
          if (!versions.length) {
            vscode.window.showErrorMessage(
              `No versions found for package ${packageName}`,
            );
            return;
          }

          // Show quick pick for version selection
          const versionItems = [
            { label: "Latest", description: versions[0] },
            {
              label: "^" + versions[0],
              description: "Compatible with most recent major version",
            },
            {
              label: "~" + versions[0],
              description: "Compatible with most recent minor version",
            },
            ...versions.map((v) => ({ label: v })),
          ];

          const selectedVersion = await vscode.window.showQuickPick(
            versionItems,
            {
              placeHolder: "Select version",
            },
          );

          if (!selectedVersion) {
            return;
          }

          try {
            await this.packageManagerService.addDependency(
              element.projectPath,
              packageName,
              selectedVersion.label === "Latest" ? "" : selectedVersion.label,
              isDev,
            );
            this.projectTreeProvider.refresh();
          } catch (error) {
            vscode.window.showErrorMessage(
              `Failed to add dependency: ${error}`,
            );
          }
        },
      ),

      vscode.commands.registerCommand(
        "dev-manager.removeDependency",
        async (element: DependencyTreeItem) => {
          const projectPath = element.projectPath;
          const packageName = element.label as string;
          const isDev = element.contextValue === "devDependency";

          // Confirm deletion
          const answer = await vscode.window.showWarningMessage(
            `Are you sure you want to remove ${packageName}?`,
            { modal: true },
            "Yes",
            "No",
          );

          if (answer !== "Yes") {
            return;
          }

          try {
            await this.packageManagerService.removeDependency(
              projectPath,
              packageName,
              isDev,
            );
            this.projectTreeProvider.refresh();
          } catch (error) {
            vscode.window.showErrorMessage(
              `Failed to remove dependency: ${error}`,
            );
          }
        },
      ),
    );
  }
}
