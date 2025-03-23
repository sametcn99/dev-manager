import * as vscode from "vscode";
import * as semver from "semver";

export class PackageManagerService {
  private static readonly LOCK_FILES: Record<string, PackageManager> = {
    "package-lock.json": "npm",
    "yarn.lock": "yarn",
    "pnpm-lock.yaml": "pnpm",
    "bun.lockb": "bun",
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
    for (const [lockFile, manager] of Object.entries(
      PackageManagerService.LOCK_FILES,
    )) {
      try {
        const lockFileUri = vscode.Uri.joinPath(projectUri, lockFile);
        await vscode.workspace.fs.stat(lockFileUri);
        return manager;
      } catch {
        continue;
      }
    }
    return "npm";
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
    } catch (error) {
      // Ignore if node_modules doesn't exist
    }

    // Delete all lock files
    for (const lockFile of Object.keys(PackageManagerService.LOCK_FILES)) {
      try {
        const lockFileUri = vscode.Uri.joinPath(projectUri, lockFile);
        await vscode.workspace.fs.delete(lockFileUri);
      } catch (error) {
        // Ignore if lock file doesn't exist
      }
    }
  }

  public async getLockFile(
    projectUri: vscode.Uri,
  ): Promise<string | undefined> {
    for (const [lockFile, manager] of Object.entries(
      PackageManagerService.LOCK_FILES,
    )) {
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

      return {
        name: packageName,
        version: installedVersion || versionRange.replace(/^[\^~]/, ""),
        versionRange,
        currentVersion: installedVersion,
        isInstalled: !!installedVersion,
        hasUpdate:
          installedVersion && latestVersion
            ? semver.lt(installedVersion, latestVersion)
            : undefined,
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
}
