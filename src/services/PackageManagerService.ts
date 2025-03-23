import * as vscode from "vscode";
import * as semver from "semver";
import { execSync } from "node:child_process";

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
    // 1. First check lock files as they are most definitive
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

    // 2. Check package.json for packageManager field
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
          return pmName as PackageManager;
        }
      }
    } catch {
      // Ignore if package.json doesn't exist or can't be parsed
    }

    // 3. Check for package manager specific config files
    for (const [configFile, manager] of Object.entries(
      PackageManagerService.CONFIG_FILES,
    )) {
      try {
        const configFileUri = vscode.Uri.joinPath(projectUri, configFile);
        await vscode.workspace.fs.stat(configFileUri);
        return manager;
      } catch {
        continue;
      }
    }

    // 4. As a last resort, check if any package manager is available in PATH
    try {
      const { execSync } = require("child_process");
      // Try pnpm first as it's least likely to be installed by default
      execSync("pnpm --version", { stdio: "ignore" });
      return "pnpm";
    } catch {
      try {
        execSync("yarn --version", { stdio: "ignore" });
        return "yarn";
      } catch {
        try {
          execSync("bun --version", { stdio: "ignore" });
          return "bun";
        } catch {
          // Default to npm only if it's actually available
          try {
            execSync("npm --version", { stdio: "ignore" });
            return "npm";
          } catch {
            // If nothing is found, still default to npm as it's most common
            return "npm";
          }
        }
      }
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
    isDev: boolean,
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
