import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

export class PackageSizeService {
  // Get the size of a specific package
  public async getPackageSize(
    projectPath: string,
    packageName: string,
  ): Promise<{ size: number; files: number }> {
    const packagePath = path.join(projectPath, "node_modules", packageName);
    return this.calculateDirectorySize(packagePath);
  }

  // Get total size of all dependencies
  public async getTotalDependenciesSize(
    projectPath: string,
  ): Promise<{
    totalSize: number;
    packages: { name: string; size: number; files: number }[];
  }> {
    const nodeModulesPath = path.join(projectPath, "node_modules");
    let totalSize = 0;
    const packages: { name: string; size: number; files: number }[] = [];

    try {
      const entries = await fs.promises.readdir(nodeModulesPath, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        if (
          entry.isDirectory() &&
          !entry.name.startsWith(".") &&
          !entry.name.startsWith("@")
        ) {
          const packageStats = await this.getPackageSize(
            projectPath,
            entry.name,
          );
          packages.push({
            name: entry.name,
            ...packageStats,
          });
          totalSize += packageStats.size;
        } else if (entry.isDirectory() && entry.name.startsWith("@")) {
          // Handle scoped packages
          const scopePath = path.join(nodeModulesPath, entry.name);
          const scopedEntries = await fs.promises.readdir(scopePath, {
            withFileTypes: true,
          });

          for (const scopedEntry of scopedEntries) {
            if (scopedEntry.isDirectory()) {
              const packageName = `${entry.name}/${scopedEntry.name}`;
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
      console.error("Error analyzing package sizes:", error);
      throw error;
    }

    // Sort packages by size in descending order
    packages.sort((a, b) => b.size - a.size);

    return { totalSize, packages };
  }

  private async calculateDirectorySize(
    dirPath: string,
  ): Promise<{ size: number; files: number }> {
    let totalSize = 0;
    let totalFiles = 0;

    try {
      const entries = await fs.promises.readdir(dirPath, {
        withFileTypes: true,
      });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          const { size, files } = await this.calculateDirectorySize(fullPath);
          totalSize += size;
          totalFiles += files;
        } else if (entry.isFile()) {
          const stats = await fs.promises.stat(fullPath);
          totalSize += stats.size;
          totalFiles++;
        }
      }
    } catch (error) {
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
