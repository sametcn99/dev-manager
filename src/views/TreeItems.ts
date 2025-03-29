import * as vscode from "vscode";
import { PackageSizeService } from "../services/PackageSizeService";

export class ProjectTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly path: string,
    public readonly packageManager: PackageManager,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly parentProject?: { name: string; path: string },
  ) {
    super(label, collapsibleState);
    this.tooltip = `${path} (${packageManager})${parentProject ? `\nNested in: ${parentProject.name}` : ""}`;
    this.description = `${packageManager}${parentProject ? ` • nested in ${parentProject.name}` : ""}`;
    this.iconPath = new vscode.ThemeIcon("package");
    this.contextValue = "project";
    this.command = {
      command: "dev-manager.analyzeDependenciesSizes",
      title: "Analyze Dependencies Sizes",
      arguments: [{ path: path }],
    };
  }
}

export class PackageManagerDropdownItem extends vscode.TreeItem {
  constructor(
    public readonly currentManager: PackageManager,
    public readonly projectPath: string,
  ) {
    super("Package Manager", vscode.TreeItemCollapsibleState.Collapsed);
    this.description = currentManager;
    this.tooltip = "Click to change package manager";
    this.iconPath = new vscode.ThemeIcon("tools");
    this.contextValue = "packageManagerDropdown";
  }
}

export class PackageManagerOptionItem extends vscode.TreeItem {
  constructor(
    public readonly manager: PackageManager,
    public readonly projectPath: string,
    public readonly isSelected: boolean,
  ) {
    super(manager, vscode.TreeItemCollapsibleState.None);
    this.description = isSelected ? "✓ Current" : "";
    this.tooltip = isSelected
      ? "Current package manager"
      : `Switch to ${manager}`;
    this.iconPath = new vscode.ThemeIcon(
      isSelected ? "check" : "circle-outline",
    );
    this.command = isSelected
      ? undefined
      : {
          command: "dev-manager.changePackageManager",
          title: "Change Package Manager",
          arguments: [{ path: projectPath, packageManager: manager }],
        };
    this.contextValue = "packageManager";
  }
}

export class UpdateSettingsItem extends vscode.TreeItem {
  constructor(
    public readonly projectPath: string,
    public readonly settings: UpdateNotificationSettings,
  ) {
    super("Update Notifications", vscode.TreeItemCollapsibleState.None);
    this.description = settings.notificationLevel;
    this.tooltip = `Current setting: ${settings.notificationLevel}\nClick to change update notification level`;
    this.iconPath = new vscode.ThemeIcon("bell");
    this.contextValue = "updateSettings";
    this.command = {
      command: "dev-manager.changeUpdateNotificationSettings",
      title: "Change Update Notification Settings",
      arguments: [
        { path: projectPath, currentSetting: settings.notificationLevel },
      ],
    };
  }
}

export class DependencyGroupTreeItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly projectPath?: string,
  ) {
    super(label, vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = "dependencyGroup";
    this.id = projectPath ? `${projectPath}:${label}` : label;
  }
}

export class DependencyTreeItem extends vscode.TreeItem {
  private packageSizeService: PackageSizeService;

  constructor(
    public readonly depInfo: PackageInfo,
    public readonly projectPath: string,
    public readonly isDev: boolean = false,
  ) {
    super(depInfo.name);
    this.packageSizeService = new PackageSizeService();
    this.tooltip = new vscode.MarkdownString();
    this.updateTooltip();
    this.contextValue = isDev ? "devDependency" : "dependency";
    this.updateDescription();
    this.updateIcon();

    // Load size information asynchronously
    this.loadSizeInfo();
  }

  private async loadSizeInfo() {
    try {
      const sizeInfo = await this.packageSizeService.getPackageSize(
        this.projectPath,
        this.depInfo.name,
      );
      this.description = `${this.depInfo.currentVersion || this.depInfo.versionRange} (${this.packageSizeService.formatSize(sizeInfo.size)})`;
      this.updateTooltip(sizeInfo);
    } catch {
      // If size info can't be loaded, keep the original description
      this.description = this.depInfo.currentVersion
        ? `${this.depInfo.versionRange} (${this.depInfo.currentVersion})`
        : this.depInfo.versionRange;
    }
  }

  private updateDescription() {
    this.description = this.depInfo.currentVersion
      ? `${this.depInfo.versionRange} (${this.depInfo.currentVersion})`
      : this.depInfo.versionRange;
  }

  private updateTooltip(sizeInfo?: { size: number; files: number }) {
    const tooltip = new vscode.MarkdownString();
    tooltip.appendMarkdown(`**${this.depInfo.name}**\n\n`);
    tooltip.appendMarkdown(
      `Current: \`${this.depInfo.currentVersion || "Not installed"}\`\n\n`,
    );
    tooltip.appendMarkdown(`Range: \`${this.depInfo.versionRange}\`\n\n`);

    if (sizeInfo) {
      tooltip.appendMarkdown(
        `Size: \`${this.packageSizeService.formatSize(sizeInfo.size)}\`\n\n`,
      );
      tooltip.appendMarkdown(`Files: \`${sizeInfo.files}\`\n\n`);
    }

    if (this.depInfo.latestVersion) {
      tooltip.appendMarkdown(`Latest: \`${this.depInfo.latestVersion}\`\n\n`);
      if (this.depInfo.hasUpdate) {
        let updateTypeLabel = "";
        switch (this.depInfo.updateType) {
          case "major":
            updateTypeLabel = "⚠️ Major update available";
            break;
          case "minor":
            updateTypeLabel = "ℹ️ Minor update available";
            break;
          case "patch":
            updateTypeLabel = "🔧 Patch update available";
            break;
          case "prerelease":
            updateTypeLabel = "🧪 Prerelease available";
            break;
          default:
            updateTypeLabel = "Update available";
        }
        tooltip.appendMarkdown(updateTypeLabel);
      }
    }

    this.tooltip = tooltip;
  }

  private updateIcon() {
    if (!this.depInfo.isInstalled) {
      this.iconPath = new vscode.ThemeIcon("warning");
    } else if (this.depInfo.hasUpdate) {
      let iconName = "arrow-up";
      if (this.depInfo.updateType === "major") {
        iconName = "arrow-up";
      } else if (this.depInfo.updateType === "minor") {
        iconName = "arrow-up";
      } else if (this.depInfo.updateType === "patch") {
        iconName = "arrow-up";
      } else if (this.depInfo.updateType === "prerelease") {
        iconName = "beaker";
      }
      this.iconPath = new vscode.ThemeIcon(iconName);
    } else {
      this.iconPath = new vscode.ThemeIcon("check");
    }

    this.command = {
      command: "dev-manager.showDependencyVersionPicker",
      title: "Change Version",
      arguments: [
        {
          packageName: this.depInfo.name,
          projectPath: this.projectPath,
          isDev: this.isDev,
          currentVersion: this.depInfo.currentVersion,
          versionRange: this.depInfo.versionRange,
          availableVersions: this.depInfo.availableVersions,
        },
      ],
    };
  }
}

export class ScriptGroupTreeItem extends vscode.TreeItem {
  constructor(public readonly projectPath: string) {
    super("Scripts", vscode.TreeItemCollapsibleState.Collapsed);
    this.contextValue = "scriptGroup";
    this.iconPath = new vscode.ThemeIcon("play");
  }
}

export class ScriptTreeItem extends vscode.TreeItem {
  constructor(
    public readonly scriptName: string,
    public readonly projectPath: string,
  ) {
    super(scriptName, vscode.TreeItemCollapsibleState.None);
    this.contextValue = "script";
    this.iconPath = new vscode.ThemeIcon("terminal");
    this.command = {
      command: "dev-manager.runScript",
      title: "Run Script",
      arguments: [{ path: projectPath, script: scriptName }],
    };
  }
}

export class LicenseTreeItem extends vscode.TreeItem {
  constructor(
    public readonly projectPath: string,
    public readonly license?: string,
  ) {
    super("License", vscode.TreeItemCollapsibleState.None);
    this.description = license || "Not specified";
    this.tooltip = `Project License: ${license || "Not specified"}`;
    this.iconPath = new vscode.ThemeIcon("law");
    this.contextValue = "license";
    this.command = {
      command: "dev-manager.changeLicense",
      title: "Change License",
      arguments: [{ path: projectPath, currentLicense: license }],
    };
  }
}

export class TasksGroupTreeItem extends vscode.TreeItem {
  constructor() {
    super("Tasks", vscode.TreeItemCollapsibleState.Collapsed);
    this.iconPath = new vscode.ThemeIcon("tasklist");
    this.contextValue = "tasksGroup";
    this.tooltip = "VS Code Tasks";
  }
}

export class TaskTreeItem extends vscode.TreeItem {
  constructor(public readonly task: vscode.Task) {
    super(task.name || "Unnamed Task", vscode.TreeItemCollapsibleState.None);

    // Get the task ID from either the label in definition or the task name
    const taskId =
      task.definition && "label" in task.definition
        ? task.definition.label
        : task.name;

    this.description = task.source;
    this.tooltip = `Type: ${task.definition.type}\nSource: ${task.source}`;
    this.iconPath = new vscode.ThemeIcon("play");
    this.contextValue = "task";
    this.command = {
      command: "dev-manager.runTask",
      title: "Run Task",
      arguments: [
        {
          taskId: taskId.startsWith("/") ? taskId.substring(1) : taskId,
        },
      ],
    };
  }
}
