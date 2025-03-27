import * as semver from "semver";
import * as vscode from "vscode";

export class PackageManagerService {
  private static readonly LOCK_FILES: Record<string, PackageManager> = {
    "package-lock.json": "npm",
    "yarn.lock": "yarn",
    "pnpm-lock.yaml": "pnpm",
    "bun.lockb": "bun",
  };

  private static readonly CONFIG_FILES: Record<string, PackageManager> = {
    ".npmrc": "npm",
    ".yarnrc": "yarn",
    ".yarnrc.yml": "yarn",
    ".pnpmfile.cjs": "pnpm",
    "pnpm-workspace.yaml": "pnpm",
    "bunfig.toml": "bun",
  };

  private static readonly COMMANDS: Record<
    PackageManager,
    Record<string, string>
  > = {
    npm: { install: "npm install", update: "npm update" },
    yarn: { install: "yarn install", update: "yarn upgrade" },
    pnpm: { install: "pnpm install", update: "pnpm update" },
    bun: { install: "bun install", update: "bun update" },
  };

  public async detectPackageManager(
    projectUri: vscode.Uri,
  ): Promise<PackageManager> {
    // Store detection results with priorities for later decision
    const detectionResults: Array<{
      manager: PackageManager;
      priority: number;
    }> = [];

    // 1. First check lock files as they are most definitive (highest priority = 3)
    for (const [lockFile, manager] of Object.entries(
      PackageManagerService.LOCK_FILES,
    )) {
      try {
        const lockFileUri = vscode.Uri.joinPath(projectUri, lockFile);
        const stat = await vscode.workspace.fs.stat(lockFileUri);

        // Only consider if the file actually has content (size > 0)
        if (stat.size > 0) {
          detectionResults.push({ manager, priority: 3 });
        }
      } catch {
        // File doesn't exist, continue to next detection method
      }
    }

    // 2. Check package.json for packageManager field (priority = 2)
    try {
      const packageJsonUri = vscode.Uri.joinPath(projectUri, "package.json");
      const packageJsonContent =
        await vscode.workspace.fs.readFile(packageJsonUri);
      const packageJson = JSON.parse(packageJsonContent.toString());

      if (packageJson.packageManager) {
        const pmName = packageJson.packageManager.split("@")[0];
        if (
          pmName === "npm" ||
          pmName === "yarn" ||
          pmName === "pnpm" ||
          pmName === "bun"
        ) {
          detectionResults.push({
            manager: pmName as PackageManager,
            priority: 2,
          });
        }
      }

      // Also check for specific package manager sections in package.json
      if (packageJson.yarn) {
        detectionResults.push({ manager: "yarn", priority: 1 });
      }
      if (packageJson.pnpm) {
        detectionResults.push({ manager: "pnpm", priority: 1 });
      }
    } catch (error) {
      // Log error but continue detection
      console.warn(`Error reading package.json: ${error}`);
    }

    // 3. Check for package manager specific config files (priority = 1)
    for (const [configFile, manager] of Object.entries(
      PackageManagerService.CONFIG_FILES,
    )) {
      try {
        const configFileUri = vscode.Uri.joinPath(projectUri, configFile);
        await vscode.workspace.fs.stat(configFileUri);
        detectionResults.push({ manager, priority: 1 });
      } catch {
        // File doesn't exist, continue to next detection method
      }
    }

    // 4. Check if node_modules directory has package manager specific modules (priority = 1)
    try {
      const nodeModulesUri = vscode.Uri.joinPath(projectUri, "node_modules");

      // Check for .yarn directory which indicates yarn usage
      try {
        const yarnDirUri = vscode.Uri.joinPath(nodeModulesUri, ".yarn");
        await vscode.workspace.fs.stat(yarnDirUri);
        detectionResults.push({ manager: "yarn", priority: 1 });
      } catch {
        // .yarn directory doesn't exist
      }

      // Check for .pnpm directory which indicates pnpm usage
      try {
        const pnpmDirUri = vscode.Uri.joinPath(nodeModulesUri, ".pnpm");
        await vscode.workspace.fs.stat(pnpmDirUri);
        detectionResults.push({ manager: "pnpm", priority: 1 });
      } catch {
        // .pnpm directory doesn't exist
      }
    } catch {
      // node_modules directory doesn't exist
    }

    // If we have detection results, sort by priority and return the highest priority manager
    if (detectionResults.length > 0) {
      detectionResults.sort((a, b) => b.priority - a.priority);
      return detectionResults[0].manager;
    }

    // 5. As a last resort, check if any package manager is available in PATH (lowest priority)
    // We'll try these in a specific order of preference: pnpm, yarn, bun, npm
    try {
      // Use VS Code API's process execution instead of direct child_process
      const processExecution = async (command: string): Promise<boolean> => {
        return new Promise((resolve) => {
          const cp = require("child_process");
          cp.exec(command, { timeout: 2000 }, (error: Error) => {
            resolve(!error);
          });
        });
      };

      // Try each package manager in order
      if (await processExecution("pnpm --version")) {
        return "pnpm";
      }

      if (await processExecution("yarn --version")) {
        return "yarn";
      }

      if (await processExecution("bun --version")) {
        return "bun";
      }

      if (await processExecution("npm --version")) {
        return "npm";
      }

      // If all else fails, default to npm as it's most commonly available
      return "npm";
    } catch (error) {
      console.warn(`Error checking package managers in PATH: ${error}`);
      return "npm"; // Default to npm as fallback
    }
  }

  // Determine update type (major, minor, patch, prerelease) based on semver
  private determineUpdateType(
    currentVersion: string,
    latestVersion: string,
  ): "major" | "minor" | "patch" | "prerelease" | undefined {
    if (!semver.valid(currentVersion) || !semver.valid(latestVersion)) {
      return undefined;
    }

    if (semver.major(latestVersion) > semver.major(currentVersion)) {
      return "major";
    } else if (semver.minor(latestVersion) > semver.minor(currentVersion)) {
      return "minor";
    } else if (semver.patch(latestVersion) > semver.patch(currentVersion)) {
      return "patch";
    } else if (
      semver.prerelease(latestVersion) !== null &&
      (semver.prerelease(currentVersion) === null ||
        semver.gt(latestVersion, currentVersion))
    ) {
      return "prerelease";
    }

    return undefined;
  }

  // Check if an update should trigger a notification based on settings
  private shouldShowUpdateNotification(
    updateType: "major" | "minor" | "patch" | "prerelease" | undefined,
    settings: UpdateNotificationSettings,
  ): boolean {
    if (!updateType) {
      return false;
    }

    switch (settings.notificationLevel) {
      case "all":
        return true;
      case "none":
        return false;
      case "major":
        return updateType === "major";
      case "minor":
        return updateType === "major" || updateType === "minor";
      case "patch":
        return (
          updateType === "major" ||
          updateType === "minor" ||
          updateType === "patch"
        );
      case "prerelease":
        return true; // Show all including prereleases
      default:
        return true;
    }
  }

  public getCommand(
    packageManager: PackageManager,
    command: "install" | "update",
  ): string {
    return PackageManagerService.COMMANDS[packageManager][command];
  }

  public async cleanupBeforePackageManagerChange(
    projectUri: vscode.Uri,
  ): Promise<void> {
    // Delete node_modules
    const nodeModulesUri = vscode.Uri.joinPath(projectUri, "node_modules");
    try {
      await vscode.workspace.fs.delete(nodeModulesUri, { recursive: true });
    } catch {
      // Ignore if node_modules doesn't exist
    }

    // Delete all lock files
    for (const lockFile of Object.keys(PackageManagerService.LOCK_FILES)) {
      try {
        const lockFileUri = vscode.Uri.joinPath(projectUri, lockFile);
        await vscode.workspace.fs.delete(lockFileUri);
      } catch {
        // Ignore if lock file doesn't exist
      }
    }
  }

  public async getLockFile(
    projectUri: vscode.Uri,
  ): Promise<string | undefined> {
    for (const [lockFile] of Object.entries(PackageManagerService.LOCK_FILES)) {
      try {
        const lockFileUri = vscode.Uri.joinPath(projectUri, lockFile);
        await vscode.workspace.fs.stat(lockFileUri);
        return lockFile;
      } catch {
        continue;
      }
    }
    return undefined;
  }

  public async getPackageVersions(packageName: string): Promise<string[]> {
    return new Promise((resolve) => {
      const { exec } = require("child_process");
      exec(
        `npm view ${packageName} versions --json`,
        (error: any, stdout: string) => {
          try {
            if (error) {
              console.error(
                `Error fetching versions for ${packageName}:`,
                error,
              );
              resolve([]);
              return;
            }

            // Parse the output to get versions
            let versions: string[] = [];
            try {
              // The output could be an array or a single string
              const parsed = JSON.parse(stdout);
              versions = Array.isArray(parsed) ? parsed : [parsed];
            } catch (parseError) {
              console.error(
                `Error parsing versions for ${packageName}:`,
                parseError,
              );
              resolve([]);
              return;
            }

            // Sort versions in descending order
            return resolve(
              versions.sort((a: string, b: string) => semver.rcompare(a, b)),
            );
          } catch (err) {
            console.error(
              `Unexpected error fetching versions for ${packageName}:`,
              err,
            );
            resolve([]);
          }
        },
      );
    });
  }

  public async updateDependencyVersion(
    projectPath: string,
    packageName: string,
    newVersion: string,
    isDev: boolean = false,
  ): Promise<void> {
    const packageJsonUri = vscode.Uri.joinPath(
      vscode.Uri.file(projectPath),
      "package.json",
    );
    try {
      const packageJsonContent =
        await vscode.workspace.fs.readFile(packageJsonUri);
      const packageJson = JSON.parse(packageJsonContent.toString());

      const dependencyType = isDev ? "devDependencies" : "dependencies";
      if (!packageJson[dependencyType]) {
        packageJson[dependencyType] = {};
      }

      packageJson[dependencyType][packageName] = newVersion;

      await vscode.workspace.fs.writeFile(
        packageJsonUri,
        Buffer.from(JSON.stringify(packageJson, null, 2)),
      );
    } catch (error) {
      throw new Error(`Failed to update version: ${error}`);
    }
  }

  public async getDependencyDetails(
    projectPath: string,
    packageName: string,
    updateSettings?: UpdateNotificationSettings,
  ): Promise<PackageInfo | undefined> {
    try {
      const packageJsonPath = vscode.Uri.joinPath(
        vscode.Uri.file(projectPath),
        "package.json",
      );
      const packageJsonContent =
        await vscode.workspace.fs.readFile(packageJsonPath);
      const packageJson = JSON.parse(packageJsonContent.toString());

      const dependencies = packageJson.dependencies || {};
      const devDependencies = packageJson.devDependencies || {};
      const versionRange =
        dependencies[packageName] || devDependencies[packageName];

      if (!versionRange) {
        return undefined;
      }

      // Check if package is installed by looking for its package.json in node_modules
      const nodeModulesPackageJson = vscode.Uri.joinPath(
        vscode.Uri.file(projectPath),
        "node_modules",
        packageName,
        "package.json",
      );
      let installedVersion: string | undefined;
      try {
        const packageContent = await vscode.workspace.fs.readFile(
          nodeModulesPackageJson,
        );
        installedVersion = JSON.parse(packageContent.toString()).version;
      } catch {
        // Package is not installed
      }

      // Get available versions from npm registry
      const availableVersions = await this.getPackageVersions(packageName);
      const latestVersion = availableVersions[0];

      // Determine update type and whether we should show update notification
      let updateType: "major" | "minor" | "patch" | "prerelease" | undefined;
      let hasUpdate = false;

      if (installedVersion && latestVersion) {
        // Check if there's any update available
        const hasAnyUpdate = semver.lt(installedVersion, latestVersion);

        if (hasAnyUpdate) {
          updateType = this.determineUpdateType(
            installedVersion,
            latestVersion,
          );

          if (updateSettings) {
            // Decide whether to show update notification based on settings
            hasUpdate = this.shouldShowUpdateNotification(
              updateType,
              updateSettings,
            );
          } else {
            // If no settings provided, default to showing any update
            hasUpdate = true;
          }
        }
      }

      return {
        name: packageName,
        version: installedVersion || versionRange.replace(/^[\^~]/, ""),
        versionRange,
        currentVersion: installedVersion,
        isInstalled: !!installedVersion,
        hasUpdate: hasUpdate,
        updateType: updateType,
        latestVersion,
        availableVersions,
      };
    } catch (error) {
      console.error(
        `Error getting dependency details for ${packageName}:`,
        error,
      );
      return undefined;
    }
  }

  public async addDependency(
    projectPath: string,
    packageName: string,
    version: string,
    isDev: boolean,
  ): Promise<void> {
    const projectUri = vscode.Uri.file(projectPath);
    const packageManager = await this.detectPackageManager(projectUri);
    const terminal = vscode.window.createTerminal(
      `Dev Manager - Add ${packageName}`,
    );
    terminal.show();

    const addCommand = {
      npm: isDev ? "npm install --save-dev" : "npm install --save",
      yarn: isDev ? "yarn add -D" : "yarn add",
      pnpm: isDev ? "pnpm add -D" : "pnpm add",
      bun: isDev ? "bun add -d" : "bun add",
    }[packageManager];

    terminal.sendText(
      `cd "${projectPath}" && ${addCommand} ${packageName}${version ? `@${version}` : ""}`,
    );
  }

  public async searchPackages(
    searchTerm: string,
  ): Promise<Array<{ name: string; description: string; version: string }>> {
    return new Promise((resolve) => {
      const { exec } = require("child_process");
      exec(
        `npm search ${searchTerm} --json --no-description-length-limit`,
        (error: any, stdout: string) => {
          try {
            if (error) {
              console.error(`Error searching packages: ${error}`);
              resolve([]);
              return;
            }

            const results = JSON.parse(stdout);
            return resolve(
              results.map((pkg: any) => ({
                name: pkg.name,
                description: pkg.description,
                version: pkg.version,
              })),
            );
          } catch (err) {
            console.error(`Unexpected error searching packages: ${err}`);
            resolve([]);
          }
        },
      );
    });
  }

  public async removeDependency(
    projectPath: string,
    packageName: string,
  ): Promise<void> {
    const projectUri = vscode.Uri.file(projectPath);
    const packageManager = await this.detectPackageManager(projectUri);
    const terminal = vscode.window.createTerminal(
      `Dev Manager - Remove ${packageName}`,
    );
    terminal.show();

    const removeCommand = {
      npm: "npm uninstall",
      yarn: "yarn remove",
      pnpm: "pnpm remove",
      bun: "bun remove",
    }[packageManager];

    terminal.sendText(`cd "${projectPath}" && ${removeCommand} ${packageName}`);
  }
}
