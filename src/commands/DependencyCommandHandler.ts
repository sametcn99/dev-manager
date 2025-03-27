import * as vscode from "vscode";
import { ProjectTreeProvider } from "../providers/ProjectTreeProvider";
import { PackageManagerService } from "../services/PackageManagerService";
import {
  DependencyGroupTreeItem,
  DependencyTreeItem,
  ProjectTreeItem,
} from "../views/TreeItems";

export class DependencyCommandHandler {
  constructor(
    private projectTreeProvider: ProjectTreeProvider,
    private packageManagerService: PackageManagerService,
  ) {}

  public registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dev-manager.installDependencies",
        this.handleInstallDependencies.bind(this),
      ),
      vscode.commands.registerCommand(
        "dev-manager.updateDependencies",
        this.handleUpdateDependencies.bind(this),
      ),
      vscode.commands.registerCommand(
        "dev-manager.cleanNodeModules",
        this.handleCleanNodeModules.bind(this),
      ),
      vscode.commands.registerCommand(
        "dev-manager.showDependencyVersionPicker",
        this.handleShowDependencyVersionPicker.bind(this),
      ),
      vscode.commands.registerCommand(
        "dev-manager.addDependency",
        this.handleAddDependency.bind(this),
      ),
      vscode.commands.registerCommand(
        "dev-manager.removeDependency",
        this.handleRemoveDependency.bind(this),
      ),
    );
  }

  private async handleInstallDependencies(item: ProjectTreeItem) {
    if (!item) {
      return;
    }

    const terminal = vscode.window.createTerminal("Dev Manager");
    terminal.show();
    const project = (await this.projectTreeProvider.getAllProjects()).find(
      (p) => p.path === item.path,
    );

    if (project) {
      const installCmd = this.packageManagerService.getCommand(
        project.packageManager,
        "install",
      );
      terminal.sendText(`cd "${project.path}" && ${installCmd}`);
    }
  }

  private async handleUpdateDependencies(item: ProjectTreeItem) {
    if (!item) {
      return;
    }

    const project = (await this.projectTreeProvider.getAllProjects()).find(
      (p) => p.path === item.path,
    );

    if (!project) {
      return;
    }

    // Check if there are any updates available according to notification settings
    const hasUpdates = [
      ...project.dependencies,
      ...project.devDependencies,
    ].some((dep) => dep.hasUpdate);

    if (!hasUpdates) {
      vscode.window.showInformationMessage(
        `No updates available according to current notification settings (${project.updateSettings.notificationLevel})`,
      );
      return;
    }

    const terminal = vscode.window.createTerminal("Dev Manager");
    terminal.show();

    const updateCmd = this.packageManagerService.getCommand(
      project.packageManager,
      "update",
    );
    terminal.sendText(`cd "${project.path}" && ${updateCmd}`);
  }

  private async handleCleanNodeModules(item: ProjectTreeItem) {
    if (!item) {
      return;
    }

    const nodeModulesUri = vscode.Uri.joinPath(
      vscode.Uri.file(item.path),
      "node_modules",
    );
    try {
      await vscode.workspace.fs.delete(nodeModulesUri, { recursive: true });
      vscode.window.showInformationMessage(
        `Cleaned node_modules in ${item.label}`,
      );
      this.projectTreeProvider.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to clean node_modules in ${item.label}: ${error}`,
      );
    }
  }

  private async handleShowDependencyVersionPicker(info: {
    packageName: string;
    projectPath: string;
    isDev: boolean;
    currentVersion?: string;
    versionRange: string;
    availableVersions?: string[];
  }) {
    // Show loading message
    const loadingMessage = vscode.window.setStatusBarMessage(
      `Fetching versions for ${info.packageName}...`,
    );
    vscode.window.showInformationMessage(
      `Fetching versions for ${info.packageName}...`,
    );

    const details = await this.packageManagerService.getDependencyDetails(
      info.projectPath,
      info.packageName,
    );

    // Clear loading message
    loadingMessage.dispose();

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
  }

  private async handleAddDependency(element: DependencyGroupTreeItem) {
    if (!element?.projectPath) {
      return;
    }

    const projectPath = element.projectPath;
    const isDev = element.label === "Dev Dependencies";

    const quickPick = vscode.window.createQuickPick();
    quickPick.title = `Search for ${isDev ? "development " : ""}dependency`;
    quickPick.placeholder = "Start typing to search for packages...";
    quickPick.busy = false;
    quickPick.items = [];

    let selectedPackage: { name: string; version: string } | undefined;
    let searchTimeout: NodeJS.Timeout;

    quickPick.onDidChangeValue(async (value) => {
      if (value.length < 2) {
        return;
      }

      quickPick.busy = true;
      clearTimeout(searchTimeout);

      searchTimeout = setTimeout(async () => {
        try {
          const results =
            await this.packageManagerService.searchPackages(value);
          if (!results.length) {
            quickPick.items = [
              {
                label: "$(warning) No packages found",
                description: "Try a different search term",
              },
            ];
            return;
          }

          quickPick.items = results.map((pkg) => ({
            label: pkg.name,
            description: pkg.version,
            detail: pkg.description,
          }));
        } catch (error) {
          quickPick.items = [
            {
              label: "$(error) Error searching packages",
              description: String(error),
            },
          ];
        } finally {
          quickPick.busy = false;
        }
      }, 300);
    });

    quickPick.onDidAccept(async () => {
      const selected = quickPick.selectedItems[0];
      if (!selected || selected.label.startsWith("$")) {
        return;
      }

      if (!selectedPackage) {
        selectedPackage = {
          name: selected.label,
          version: selected.description || "",
        };

        quickPick.busy = true;
        const versions = await this.packageManagerService.getPackageVersions(
          selectedPackage.name,
        );
        quickPick.busy = false;

        if (!versions.length) {
          vscode.window.showErrorMessage(
            `No versions found for package ${selectedPackage.name}`,
          );
          quickPick.hide();
          return;
        }

        quickPick.value = "";
        quickPick.placeholder = "Select version...";
        quickPick.items = [
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
      } else {
        const version = selected.label === "Latest" ? "" : selected.label;
        quickPick.hide();

        try {
          await this.packageManagerService.addDependency(
            projectPath,
            selectedPackage.name,
            version,
            isDev,
          );
          this.projectTreeProvider.refresh();
        } catch (error) {
          vscode.window.showErrorMessage(`Failed to add dependency: ${error}`);
        }
      }
    });

    quickPick.onDidHide(() => quickPick.dispose());
    quickPick.show();
  }

  private async handleRemoveDependency(element: DependencyTreeItem) {
    const projectPath = element.projectPath;
    const packageName = element.label as string;

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
      );
      this.projectTreeProvider.refresh();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to remove dependency: ${error}`);
    }
  }
}
