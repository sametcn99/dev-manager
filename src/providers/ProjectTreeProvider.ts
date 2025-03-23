import * as vscode from "vscode";
import { ProjectService } from "../services/ProjectService";
import { ProjectTreeItem, DependencyTreeItem } from "../views/TreeItems";
import { ProjectInfo } from "../types/ProjectInfo";

export class ProjectTreeProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  private projects: ProjectInfo[] = [];
  private projectService: ProjectService;

  constructor() {
    this.projectService = new ProjectService();
  }

  refresh(): void {
    this._onDidChangeTreeData.fire(undefined);
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
            vscode.TreeItemCollapsibleState.Collapsed,
          ),
      );
    }

    if (element instanceof ProjectTreeItem) {
      const project = this.projects.find((p) => p.path === element.path);
      if (!project) {
        return [];
      }

      return [
        ...project.dependencies.map((dep) => new DependencyTreeItem(dep)),
        ...project.devDependencies.map(
          (dep) => new DependencyTreeItem(dep, true),
        ),
      ];
    }

    return [];
  }

  public async getAllProjects(): Promise<ProjectInfo[]> {
    if (this.projects.length === 0) {
      this.projects = await this.projectService.scanWorkspace();
    }
    return this.projects;
  }

  public async changePackageManager(
    item: ProjectTreeItem,
    newPackageManager: PackageManager,
  ): Promise<void> {
    const project = this.projects.find((p) => p.path === item.path);
    if (project) {
      project.packageManager = newPackageManager;
      this._onDidChangeTreeData.fire(undefined);
    }
  }
}
