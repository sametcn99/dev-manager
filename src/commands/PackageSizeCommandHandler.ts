import * as vscode from "vscode";
import { ProjectTreeProvider } from "../providers/ProjectTreeProvider";
import { PackageSizeService } from "../services/PackageSizeService";
import { DependencyTreeItem } from "../views/TreeItems";

export class PackageSizeCommandHandler {
  private packageSizeService: PackageSizeService;

  constructor(private projectTreeProvider: ProjectTreeProvider) {
    this.packageSizeService = new PackageSizeService();
  }

  public registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dev-manager.analyzePackageSize",
        this.handleAnalyzePackageSize.bind(this),
      ),
      vscode.commands.registerCommand(
        "dev-manager.analyzeDependenciesSizes",
        this.handleAnalyzeDependenciesSizes.bind(this),
      ),
    );
  }

  private async handleAnalyzePackageSize(item: DependencyTreeItem) {
    if (!item?.projectPath) {
      return;
    }

    try {
      const packageStats = await this.packageSizeService.getPackageSize(
        item.projectPath,
        item.depInfo.name,
      );

      const formattedSize = this.packageSizeService.formatSize(
        packageStats.size,
      );

      const message =
        `Package: ${item.depInfo.name}\n` +
        `Size: ${formattedSize}\n` +
        `Files: ${packageStats.files}`;

      vscode.window
        .showInformationMessage(message, "View Details")
        .then((selection) => {
          if (selection === "View Details") {
            // Show more detailed information in a new editor
            const detailsContent = new vscode.MarkdownString();
            detailsContent.appendMarkdown(
              `# Package Size Analysis: ${item.depInfo.name}\n\n`,
            );
            detailsContent.appendMarkdown(`## Overview\n`);
            detailsContent.appendMarkdown(`- Total Size: ${formattedSize}\n`);
            detailsContent.appendMarkdown(
              `- Total Files: ${packageStats.files}\n`,
            );
            detailsContent.appendMarkdown(
              `- Current Version: ${item.depInfo.currentVersion}\n`,
            );
            detailsContent.appendMarkdown(
              `- Version Range: ${item.depInfo.versionRange}\n\n`,
            );

            const panel = vscode.window.createWebviewPanel(
              "packageSizeAnalysis",
              `Size Analysis: ${item.depInfo.name}`,
              vscode.ViewColumn.One,
              {
                enableScripts: false,
              },
            );

            panel.webview.html = `
            <!DOCTYPE html>
            <html>
              <body>
                ${detailsContent.value}
              </body>
            </html>
          `;
          }
        });
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to analyze package size: ${error}`,
      );
    }
  }

  private async handleAnalyzeDependenciesSizes(info?: { path: string }) {
    // If path isn't provided directly, get the first active project path from the tree provider
    let projectPath = info?.path;

    if (!projectPath) {
      const projects = await this.projectTreeProvider.getAllProjects();
      if (projects && projects.length > 0) {
        projectPath = projects[0].path;
      } else {
        vscode.window.showErrorMessage("No projects found to analyze");
        return;
      }
    }

    // Show immediate feedback
    vscode.window.showInformationMessage("Analyzing dependencies sizes...");

    const progressOptions = {
      location: vscode.ProgressLocation.Notification,
      title: "Analyzing package sizes...",
      cancellable: false,
    };

    try {
      const analysis = await vscode.window.withProgress(progressOptions, () =>
        this.packageSizeService.getTotalDependenciesSize(projectPath!),
      );

      const formattedTotalSize = this.packageSizeService.formatSize(
        analysis.totalSize,
      );

      // Create and show webview with detailed analysis
      const panel = vscode.window.createWebviewPanel(
        "dependencySizeAnalysis",
        "Dependencies Size Analysis",
        vscode.ViewColumn.One,
        {
          enableScripts: false,
        },
      );

      const content = new vscode.MarkdownString();
      content.appendMarkdown(`# Dependencies Size Analysis\n\n`);
      content.appendMarkdown(`## Total Size: ${formattedTotalSize}\n\n`);
      content.appendMarkdown(`## Package Breakdown\n\n`);
      content.appendMarkdown(`| Package | Size | Files |\n`);
      content.appendMarkdown(`|---------|------|-------|\n`);

      analysis.packages.forEach((pkg) => {
        const formattedSize = this.packageSizeService.formatSize(pkg.size);
        content.appendMarkdown(
          `| ${pkg.name} | ${formattedSize} | ${pkg.files} |\n`,
        );
      });

      panel.webview.html = `
        <!DOCTYPE html>
        <html>
          <body>
            <style>
              body { padding: 20px; }
              table { border-collapse: collapse; width: 100%; }
              th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
              th { background-color: var(--vscode-editor-background); }
            </style>
            ${content.value}
          </body>
        </html>
      `;
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to analyze dependencies sizes: ${error}`,
      );
    }
  }
}
