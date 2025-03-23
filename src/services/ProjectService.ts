import * as vscode from "vscode";
import { ProjectInfo } from "../types/ProjectInfo";
import { PackageManagerService } from "./PackageManagerService";

export class ProjectService {
  private packageManagerService: PackageManagerService;

  constructor() {
    this.packageManagerService = new PackageManagerService();
  }

  // Default settings for update notifications - set to minor by default as requested
  private defaultUpdateSettings: UpdateNotificationSettings = {
    notificationLevel: "minor",
  };

  // Helper to load project-specific settings from a config file if it exists
  private async loadProjectUpdateSettings(
    projectUri: vscode.Uri,
  ): Promise<UpdateNotificationSettings> {
    try {
      // Look for a .dev-manager.json configuration file in the project directory
      const configFileUri = vscode.Uri.joinPath(
        projectUri,
        ".dev-manager.json",
      );
      const configContent = await vscode.workspace.fs.readFile(configFileUri);
      const config = JSON.parse(configContent.toString());

      // Validate and return the settings
      if (config.updateSettings?.notificationLevel) {
        const validLevels = [
          "major",
          "minor",
          "patch",
          "prerelease",
          "all",
          "none",
        ];
        if (validLevels.includes(config.updateSettings.notificationLevel)) {
          return {
            notificationLevel: config.updateSettings
              .notificationLevel as UpdateNotificationType,
          };
        }
      }
      return this.defaultUpdateSettings;
    } catch {
      // If file doesn't exist or can't be parsed, return default settings
      return this.defaultUpdateSettings;
    }
  }

  // Helper to save project-specific settings to a config file
  public async saveProjectUpdateSettings(
    projectPath: string,
    settings: UpdateNotificationSettings,
  ): Promise<void> {
    try {
      const projectUri = vscode.Uri.file(projectPath);
      const configFileUri = vscode.Uri.joinPath(
        projectUri,
        ".dev-manager.json",
      );

      // Try to read existing config
      let config = {};
      try {
        const existingContent =
          await vscode.workspace.fs.readFile(configFileUri);
        config = JSON.parse(existingContent.toString());
      } catch {
        // File doesn't exist yet, use empty config
      }

      // Update config with new settings
      config = {
        ...config,
        updateSettings: settings,
      };

      // Write back to file
      await vscode.workspace.fs.writeFile(
        configFileUri,
        Buffer.from(JSON.stringify(config, null, 2)),
      );
    } catch (error) {
      throw new Error(`Failed to save update settings: ${error}`);
    }
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
        const projectUri = vscode.Uri.joinPath(packageJsonUri, "..");
        const projectPath = projectUri.fsPath;

        // Skip if this path or any parent path has already been processed
        if (
          processedPaths.has(projectPath) ||
          Array.from(processedPaths).some((p) =>
            projectPath.startsWith(p + "/"),
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

    // Load project-specific update settings or use defaults
    const updateSettings = await this.loadProjectUpdateSettings(projectUri);

    const dependencies = await this.getDependencyInfo(
      packageJson.dependencies || {},
      projectUri,
      updateSettings,
    );
    const devDependencies = await this.getDependencyInfo(
      packageJson.devDependencies || {},
      projectUri,
      updateSettings,
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
      scripts: packageJson.scripts || {},
      updateSettings,
      license: packageJson.license || undefined,
    };
  }

  private async getDependencyInfo(
    deps: Record<string, string>,
    projectUri: vscode.Uri,
    updateSettings: UpdateNotificationSettings,
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
            updateSettings,
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
          updateType: undefined,
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
