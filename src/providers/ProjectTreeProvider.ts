import * as vscode from "vscode";
import { ProjectService } from "../services/ProjectService";
import {
  ProjectTreeItem,
  DependencyTreeItem,
  PackageManagerDropdownItem,
  PackageManagerOptionItem,
  DependencyGroupTreeItem,
  ScriptGroupTreeItem,
  ScriptTreeItem,
} from "../views/TreeItems";
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

  private readonly availablePackageManagers: PackageManager[] = [
    "npm",
    "yarn",
    "pnpm",
    "bun",
  ];

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

      // Show package manager dropdown, scripts group, and dependency groups
      return [
        new PackageManagerDropdownItem(project.packageManager, project.path),
        new ScriptGroupTreeItem(project.path),
        new DependencyGroupTreeItem("Dependencies", project.path),
        new DependencyGroupTreeItem("Dev Dependencies", project.path),
      ];
    }

    if (element instanceof ScriptGroupTreeItem) {
      const project = this.projects.find((p) => p.path === element.projectPath);
      if (!project) {
        return [];
      }

      return Object.keys(project.scripts).map(
        (scriptName) => new ScriptTreeItem(scriptName, project.path),
      );
    }

    if (element instanceof PackageManagerDropdownItem) {
      // Show package manager options when dropdown is expanded
      return this.availablePackageManagers.map(
        (pm) =>
          new PackageManagerOptionItem(
            pm,
            element.projectPath,
            pm === element.currentManager,
          ),
      );
    }

    if (element instanceof DependencyGroupTreeItem && element.projectPath) {
      const project = this.projects.find((p) => p.path === element.projectPath);
      if (!project) {
        return [];
      }

      if (element.label === "Dependencies") {
        return project.dependencies.map(
          (dep) => new DependencyTreeItem(dep, project.path, false),
        );
      } else if (element.label === "Dev Dependencies") {
        return project.devDependencies.map(
          (dep) => new DependencyTreeItem(dep, project.path, true),
        );
      }
    }

    return [];
  }

  private async findParentProject(
    element: vscode.TreeItem,
  ): Promise<ProjectTreeItem | undefined> {
    // Save element's parent in an array to track its path
    const path: vscode.TreeItem[] = [];
    let current = element;

    // Walk up the tree to find the parent project
    while (current) {
      const parent = await this.findParent(current, path);
      if (!parent) {
        break;
      }
      path.unshift(parent);
      if (parent instanceof ProjectTreeItem) {
        return parent;
      }
      current = parent;
    }
    return undefined;
  }

  private async findParent(
    child: vscode.TreeItem,
    path: vscode.TreeItem[],
  ): Promise<vscode.TreeItem | undefined> {
    for (const project of this.projects) {
      const projectItem = new ProjectTreeItem(
        project.name,
        project.path,
        project.packageManager,
        vscode.TreeItemCollapsibleState.Expanded,
      );

      // If we're looking for a project's direct child
      if (path.length === 0) {
        const children = await this.getChildren(projectItem);
        if (children.some((item) => item.label === child.label)) {
          return projectItem;
        }
      }
      // If we're looking within a project's tree
      else if (path[0].label === projectItem.label) {
        let currentParent: vscode.TreeItem = projectItem;
        let currentPath = path.slice(1);

        // Walk down the saved path to find the immediate parent
        for (const pathItem of currentPath) {
          const children = await this.getChildren(currentParent);
          const nextParent = children.find(
            (item) => item.label === pathItem.label,
          );
          if (!nextParent) {
            return undefined;
          }
          currentParent = nextParent;
        }

        // Check if the child belongs to the currentParent
        const children = await this.getChildren(currentParent);
        if (children.some((item) => item.label === child.label)) {
          return currentParent;
        }
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

  public async changePackageManager(info: {
    path: string;
    packageManager: PackageManager;
  }): Promise<void> {
    const project = this.projects.find((p) => p.path === info.path);
    if (project) {
      project.packageManager = info.packageManager;
      // Find and refresh the specific dropdown item to ensure it updates
      const projectItem = this.projects
        .map(
          (p) =>
            new ProjectTreeItem(
              p.name,
              p.path,
              p.packageManager,
              vscode.TreeItemCollapsibleState.Expanded,
            ),
        )
        .find((p) => p.path === info.path);

      if (projectItem) {
        const children = await this.getChildren(projectItem);
        const dropdown = children.find(
          (child) => child instanceof PackageManagerDropdownItem,
        );
        if (dropdown) {
          this.refresh(dropdown);
        }
      }
      this.refresh();
    }
  }

  public async updateDependencyVersion(
    projectPath: string,
    packageName: string,
    newVersion: string,
    isDev: boolean,
  ): Promise<void> {
    const project = this.projects.find((p) => p.path === projectPath);
    if (project) {
      await this.projectService.updateDependencyVersion(
        projectPath,
        packageName,
        newVersion,
        isDev,
      );
      // Refresh the specific project to update its dependencies
      this.refresh();
    }
  }
}
