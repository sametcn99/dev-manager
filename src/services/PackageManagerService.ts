import * as vscode from "vscode";

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
}
