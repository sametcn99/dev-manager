import * as vscode from "vscode";

export class ProjectTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly path: string,
    public readonly packageManager: PackageManager,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
  ) {
    super(label, collapsibleState);
    this.tooltip = `${path} (${packageManager})`;
    this.description = packageManager;
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
    private readonly depInfo: PackageInfo,
    private readonly projectPath: string,
    private readonly isDev: boolean = false,
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
        this.tooltip.appendMarkdown(`⚠️ Update available`);
      }
    }

    this.description = depInfo.currentVersion
      ? `${depInfo.versionRange} (${depInfo.currentVersion})`
      : depInfo.versionRange;

    this.contextValue = isDev ? "devDependency" : "dependency";

    if (!depInfo.isInstalled) {
      this.iconPath = new vscode.ThemeIcon("warning");
    } else if (depInfo.hasUpdate) {
      this.iconPath = new vscode.ThemeIcon("arrow-up");
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
