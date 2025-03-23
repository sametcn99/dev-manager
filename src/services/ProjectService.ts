import * as vscode from "vscode";
import { ProjectInfo } from "../types/ProjectInfo";
import { PackageManagerService } from "./PackageManagerService";
import * as path from "path";

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
    const allPackageJsons: vscode.Uri[] = [];

    // First, collect all package.json files
    for (const folder of workspaceFolders) {
      const packageJsonFiles = await vscode.workspace.findFiles(
        new vscode.RelativePattern(folder, "**/package.json"),
        "**/node_modules/**",
      );
      allPackageJsons.push(...packageJsonFiles);
    }

    // Sort package.json files by path length (shortest first) to process parent projects first
    allPackageJsons.sort((a, b) => a.fsPath.length - b.fsPath.length);

    // Track used paths to avoid duplicate processing
    const processedPaths = new Set<string>();

    for (const packageJsonUri of allPackageJsons) {
      try {
        const projectPath = vscode.Uri.joinPath(packageJsonUri, "..").fsPath;

        // Skip if this path or any parent path has already been processed
        if (
          processedPaths.has(projectPath) ||
          Array.from(processedPaths).some((p) =>
            projectPath.startsWith(p + path.sep),
          )
        ) {
          continue;
        }

        const project = await this.createProjectInfo(packageJsonUri);
        if (project) {
          projects.push(project);
          processedPaths.add(projectPath);
        }
      } catch (error) {
        console.error(`Error processing ${packageJsonUri.fsPath}:`, error);
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
    const nodeModulesPath = vscode.Uri.joinPath(projectUri, "node_modules");
    const nodeModulesExists = await vscode.workspace.fs
      .stat(nodeModulesPath)
      .then(
        () => true,
        () => false,
      );

    return Promise.all(
      Object.entries(deps).map(async ([name, version]) => {
        if (nodeModulesExists) {
          const details = await this.packageManagerService.getDependencyDetails(
            projectUri.fsPath,
            name,
          );
          if (details) {
            return details;
          }
        }

        // Fallback if getDependencyDetails fails or node_modules doesn't exist
        return {
          name,
          version: version.replace(/^[\^~]/, ""),
          versionRange: version,
          isInstalled: false,
          currentVersion: undefined,
          hasUpdate: undefined,
          latestVersion: undefined,
          availableVersions: [],
        };
      }),
    );
  }

  public async updateDependencyVersion(
    projectPath: string,
    packageName: string,
    newVersion: string,
    isDev: boolean,
  ): Promise<void> {
    await this.packageManagerService.updateDependencyVersion(
      projectPath,
      packageName,
      newVersion,
      isDev,
    );
    // Trigger reinstallation
    const projectUri = vscode.Uri.file(projectPath);
    const packageManager =
      await this.packageManagerService.detectPackageManager(projectUri);
    const terminal = vscode.window.createTerminal(
      `Dev Manager - Install ${packageName}`,
    );
    terminal.show();
    const installCmd = this.packageManagerService.getCommand(
      packageManager,
      "install",
    );
    terminal.sendText(`cd "${projectPath}" && ${installCmd}`);
  }
}
