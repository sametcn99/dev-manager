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

export class DependencyTreeItem extends vscode.TreeItem {
  constructor(
    private readonly depInfo: PackageInfo,
    private readonly isDev: boolean = false,
  ) {
    super(depInfo.name);
    this.tooltip = `${depInfo.name}@${depInfo.version}`;
    this.description = depInfo.version;
    this.contextValue = isDev ? "devDependency" : "dependency";

    if (!depInfo.isInstalled) {
      this.iconPath = new vscode.ThemeIcon("warning");
    } else if (depInfo.hasUpdate) {
      this.iconPath = new vscode.ThemeIcon("arrow-up");
    } else {
      this.iconPath = new vscode.ThemeIcon("check");
    }
  }
}
