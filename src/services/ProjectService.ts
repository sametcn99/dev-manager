import * as vscode from "vscode";
import { ProjectInfo } from "../types/ProjectInfo";
import { PackageManagerService } from "./PackageManagerService";

export class ProjectService {
  private packageManagerService: PackageManagerService;

  constructor() {
    this.packageManagerService = new PackageManagerService();
  }

  public async scanWorkspace(): Promise<ProjectInfo[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return [];
    }

    const projects: ProjectInfo[] = [];
    for (const folder of workspaceFolders) {
      const packageJsonFiles = await vscode.workspace.findFiles(
        new vscode.RelativePattern(folder, "**/package.json"),
        "**/node_modules/**",
      );

      for (const packageJsonUri of packageJsonFiles) {
        try {
          const project = await this.createProjectInfo(packageJsonUri);
          if (project) {
            projects.push(project);
          }
        } catch (error) {
          console.error(`Error processing ${packageJsonUri.fsPath}:`, error);
        }
      }
    }

    return projects;
  }

  private async createProjectInfo(
    packageJsonUri: vscode.Uri,
  ): Promise<ProjectInfo> {
    const packageJsonContent =
      await vscode.workspace.fs.readFile(packageJsonUri);
    const packageJson = JSON.parse(packageJsonContent.toString());
    const projectUri = vscode.Uri.joinPath(packageJsonUri, "..");

    const dependencies = await this.getDependencyInfo(
      packageJson.dependencies || {},
      projectUri,
    );
    const devDependencies = await this.getDependencyInfo(
      packageJson.devDependencies || {},
      projectUri,
    );
    const packageManager =
      await this.packageManagerService.detectPackageManager(projectUri);

    return {
      name: packageJson.name || projectUri.fsPath.split(/[\\/]/).pop()!,
      path: projectUri.fsPath,
      uri: projectUri,
      dependencies,
      devDependencies,
      packageManager,
    };
  }

  private async getDependencyInfo(
    deps: Record<string, string>,
    projectUri: vscode.Uri,
  ): Promise<PackageInfo[]> {
    return Promise.all(
      Object.entries(deps).map(async ([name, version]) => {
        const nodeModulesUri = vscode.Uri.joinPath(projectUri, "node_modules");
        const depPackageJsonUri = vscode.Uri.joinPath(
          nodeModulesUri,
          name,
          "package.json",
        );
        let isInstalled = false;
        let installedVersion = "";

        try {
          await vscode.workspace.fs.stat(depPackageJsonUri);
          isInstalled = true;

          if (isInstalled) {
            const content =
              await vscode.workspace.fs.readFile(depPackageJsonUri);
            const depPackageJson = JSON.parse(content.toString());
            installedVersion = depPackageJson.version;
          }
        } catch (error) {
          // Package not installed or can't read package.json
        }

        return {
          name,
          version: version.replace(/^[\^~]/, ""),
          isInstalled,
        };
      }),
    );
  }
}
