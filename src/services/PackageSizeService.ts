import * as vscode from "vscode";

export class PackageSizeService {
  // Get the size of a specific package
  public async getPackageSize(
    projectPath: string,
    packageName: string,
  ): Promise<{ size: number; files: number }> {
    const packageUri = vscode.Uri.joinPath(
      vscode.Uri.file(projectPath),
      "node_modules",
      packageName,
    );
    return this.calculateDirectorySize(packageUri);
  }

  // Get total size of all dependencies
  public async getTotalDependenciesSize(projectPath: string): Promise<{
    totalSize: number;
    packages: { name: string; size: number; files: number }[];
  }> {
    const nodeModulesUri = vscode.Uri.joinPath(
      vscode.Uri.file(projectPath),
      "node_modules",
    );
    let totalSize = 0;
    const packages: { name: string; size: number; files: number }[] = [];

    try {
      const entries = await vscode.workspace.fs.readDirectory(nodeModulesUri);

      for (const [entryName, entryType] of entries) {
        if (
          entryType === vscode.FileType.Directory &&
          !entryName.startsWith(".") &&
          !entryName.startsWith("@")
        ) {
          const packageStats = await this.getPackageSize(
            projectPath,
            entryName,
          );
          packages.push({
            name: entryName,
            ...packageStats,
          });
          totalSize += packageStats.size;
        } else if (
          entryType === vscode.FileType.Directory &&
          entryName.startsWith("@")
        ) {
          // Handle scoped packages
          const scopeUri = vscode.Uri.joinPath(nodeModulesUri, entryName);
          const scopedEntries =
            await vscode.workspace.fs.readDirectory(scopeUri);

          for (const [scopedEntryName, scopedEntryType] of scopedEntries) {
            if (scopedEntryType === vscode.FileType.Directory) {
              const packageName = `${entryName}/${scopedEntryName}`;
              const packageStats = await this.getPackageSize(
                projectPath,
                packageName,
              );
              packages.push({
                name: packageName,
                ...packageStats,
              });
              totalSize += packageStats.size;
            }
          }
        }
      }
    } catch (error) {
      vscode.window.showErrorMessage(
        `Error analyzing package sizes in ${nodeModulesUri.fsPath}: ${error}`,
      );
      throw error;
    }

    // Sort packages by size in descending order
    packages.sort((a, b) => b.size - a.size);

    return { totalSize, packages };
  }

  private async calculateDirectorySize(
    dirUri: vscode.Uri,
  ): Promise<{ size: number; files: number }> {
    let totalSize = 0;
    let totalFiles = 0;

    try {
      const entries = await vscode.workspace.fs.readDirectory(dirUri);

      for (const [entryName, entryType] of entries) {
        const fullPath = vscode.Uri.joinPath(dirUri, entryName);

        if (entryType === vscode.FileType.Directory) {
          const { size, files } = await this.calculateDirectorySize(fullPath);
          totalSize += size;
          totalFiles += files;
        } else if (entryType === vscode.FileType.File) {
          const stat = await vscode.workspace.fs.stat(fullPath);
          totalSize += stat.size;
          totalFiles++;
        }
      }
    } catch {
      // Directory or file might not exist, return current totals
      return { size: totalSize, files: totalFiles };
    }

    return { size: totalSize, files: totalFiles };
  }

  // Format size to human readable format
  public formatSize(bytes: number): string {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }
}
