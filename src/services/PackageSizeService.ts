import * as vscode from "vscode";

/**
 * Interface for dependency analysis result
 */
export interface DependencyAnalysisResult {
  totalSize: number;
  packages: { name: string; size: number; files: number }[];
  dependenciesInstalled: boolean;
}

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

  /**
   * Check if node_modules exists for the given project
   */
  public async checkNodeModulesExists(projectPath: string): Promise<boolean> {
    const nodeModulesUri = vscode.Uri.joinPath(
      vscode.Uri.file(projectPath),
      "node_modules",
    );

    try {
      const stat = await vscode.workspace.fs.stat(nodeModulesUri);
      return stat.type === vscode.FileType.Directory;
    } catch {
      // If error occurs, node_modules doesn't exist or can't be accessed
      return false;
    }
  }

  // Get total size of all dependencies
  public async getTotalDependenciesSize(
    projectPath: string,
  ): Promise<DependencyAnalysisResult> {
    const nodeModulesUri = vscode.Uri.joinPath(
      vscode.Uri.file(projectPath),
      "node_modules",
    );
    let totalSize = 0;
    const packages: { name: string; size: number; files: number }[] = [];

    // Check if node_modules exists
    const nodeModulesExists = await this.checkNodeModulesExists(projectPath);

    if (!nodeModulesExists) {
      // Return empty result with dependenciesInstalled=false to indicate node_modules doesn't exist
      return { totalSize: 0, packages: [], dependenciesInstalled: false };
    }

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
      // If we reach here, node_modules exists but there was another issue reading it
      vscode.window.showErrorMessage(
        `Error analyzing package sizes in ${nodeModulesUri.fsPath}: ${error}`,
      );
      return { totalSize: 0, packages: [], dependenciesInstalled: true };
    }

    // Sort packages by size in descending order
    packages.sort((a, b) => b.size - a.size);

    return { totalSize, packages, dependenciesInstalled: true };
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
