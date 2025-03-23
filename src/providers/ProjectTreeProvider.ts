import * as vscode from "vscode";
import { ProjectService } from "../services/ProjectService";
import { ProjectTreeItem, DependencyTreeItem, PackageManagerDropdownItem, PackageManagerOptionItem, DependencyGroupTreeItem } from "../views/TreeItems";
import { ProjectInfo } from "../types/ProjectInfo";

export class ProjectTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<vscode.TreeItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private projects: ProjectInfo[] = [];
  private projectService: ProjectService;

  private readonly availablePackageManagers: PackageManager[] = ["npm", "yarn", "pnpm", "bun"];

  constructor() {
    this.projectService = new ProjectService();
  }

  refresh(element?: vscode.TreeItem): void {
    this._onDidChangeTreeData.fire(element);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      this.projects = await this.projectService.scanWorkspace();
      return this.projects.map(
        (project) =>
          new ProjectTreeItem(
            project.name,
            project.path,
            project.packageManager,
            vscode.TreeItemCollapsibleState.Expanded,
          ),
      );
    }

    if (element instanceof ProjectTreeItem) {
      const project = this.projects.find((p) => p.path === element.path);
      if (!project) {
        return [];
      }

      // Show package manager dropdown as first item
      return [
        new PackageManagerDropdownItem(project.packageManager, project.path),
        new DependencyGroupTreeItem("Dependencies"),
        new DependencyGroupTreeItem("Dev Dependencies")
      ];
    }

    if (element instanceof PackageManagerDropdownItem) {
      // Show package manager options when dropdown is expanded
      return this.availablePackageManagers.map(
        (pm) => new PackageManagerOptionItem(pm, element.projectPath, pm === element.currentManager)
      );
    }

    if (element instanceof DependencyGroupTreeItem) {
      const projectItem = await this.findParentProject(element);
      if (!projectItem) {
        return [];
      }

      const project = this.projects.find((p) => p.path === projectItem.path);
      if (!project) {
        return [];
      }

      if (element.label === "Dependencies") {
        return project.dependencies.map((dep) => new DependencyTreeItem(dep));
      } else if (element.label === "Dev Dependencies") {
        return project.devDependencies.map((dep) => new DependencyTreeItem(dep, true));
      }
    }

    return [];
  }

  private async findParentProject(element: vscode.TreeItem): Promise<ProjectTreeItem | undefined> {
    for (const project of this.projects) {
      const projectItem = new ProjectTreeItem(
        project.name,
        project.path,
        project.packageManager,
        vscode.TreeItemCollapsibleState.Expanded
      );
      
      const children = await this.getChildren(projectItem);
      if (children.some((item: vscode.TreeItem) => item.label === element.label)) {
        return projectItem;
      }
    }
    return undefined;
  }

  public async getAllProjects(): Promise<ProjectInfo[]> {
    if (this.projects.length === 0) {
      this.projects = await this.projectService.scanWorkspace();
    }
    return this.projects;
  }

  public async changePackageManager(
    info: { path: string; packageManager: PackageManager },
  ): Promise<void> {
    const project = this.projects.find((p) => p.path === info.path);
    if (project) {
      project.packageManager = info.packageManager;
      // Find and refresh the specific dropdown item to ensure it updates
      const projectItem = this.projects.map(p => 
        new ProjectTreeItem(p.name, p.path, p.packageManager, vscode.TreeItemCollapsibleState.Expanded)
      ).find(p => p.path === info.path);

      if (projectItem) {
        const children = await this.getChildren(projectItem);
        const dropdown = children.find(child => child instanceof PackageManagerDropdownItem);
        if (dropdown) {
          this.refresh(dropdown);
        }
      }
      this.refresh();
    }
  }
}
