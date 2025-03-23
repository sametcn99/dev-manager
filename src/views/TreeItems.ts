import * as vscode from "vscode";

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
  constructor(
    public readonly depInfo: PackageInfo,
    public readonly projectPath: string,
    public readonly isDev: boolean = false,
  ) {
    super(depInfo.name);
    this.tooltip = new vscode.MarkdownString();
    this.tooltip.appendMarkdown(`**${depInfo.name}**\n\n`);
    this.tooltip.appendMarkdown(
      `Current: \`${depInfo.currentVersion || "Not installed"}\`\n\n`,
    );
    this.tooltip.appendMarkdown(`Range: \`${depInfo.versionRange}\`\n\n`);
    if (depInfo.latestVersion) {
      this.tooltip.appendMarkdown(`Latest: \`${depInfo.latestVersion}\`\n\n`);
      if (depInfo.hasUpdate) {
        // Enhanced tooltip to show update type
        let updateTypeLabel = "";
        switch (depInfo.updateType) {
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
        this.tooltip.appendMarkdown(updateTypeLabel);
      }
    }

    this.description = depInfo.currentVersion
      ? `${depInfo.versionRange} (${depInfo.currentVersion})`
      : depInfo.versionRange;

    this.contextValue = isDev ? "devDependency" : "dependency";

    if (!depInfo.isInstalled) {
      this.iconPath = new vscode.ThemeIcon("warning");
    } else if (depInfo.hasUpdate) {
      // Use different icons based on update type
      let iconName = "arrow-up";
      if (depInfo.updateType === "major") {
        iconName = "arrow-up"; // Keep red arrow for major updates
      } else if (depInfo.updateType === "minor") {
        iconName = "arrow-up"; // Standard arrow for minor updates
      } else if (depInfo.updateType === "patch") {
        iconName = "arrow-up"; // Lighter arrow for patch updates
      } else if (depInfo.updateType === "prerelease") {
        iconName = "beaker"; // Experiment icon for prereleases
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
          packageName: depInfo.name,
          projectPath: this.projectPath,
          isDev: this.isDev,
          currentVersion: depInfo.currentVersion,
          versionRange: depInfo.versionRange,
          availableVersions: depInfo.availableVersions,
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
