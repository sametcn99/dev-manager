import * as vscode from "vscode";
import { ProjectTreeProvider } from "../providers/ProjectTreeProvider";
import { PackageSizeService } from "../services/PackageSizeService";
import { DependencyTreeItem } from "../views/TreeItems";

export class PackageSizeCommandHandler {
  private packageSizeService: PackageSizeService;
  private templateUri: vscode.Uri;

  constructor(
    private projectTreeProvider: ProjectTreeProvider,
    private context: vscode.ExtensionContext,
  ) {
    this.packageSizeService = new PackageSizeService();
    // Use the extension's root path to correctly resolve the template path
    this.templateUri = vscode.Uri.joinPath(
      this.context.extensionUri,
      "src",
      "views",
      "templates",
      "packageSizeAnalysis.html",
    );
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
    const projects = await this.projectTreeProvider.getAllProjects();

    if (!info?.path && projects.length > 1) {
      const progressOptions = {
        location: vscode.ProgressLocation.Notification,
        title: "Analyzing all projects' package sizes...",
        cancellable: false,
      };

      try {
        const allAnalysis = await vscode.window.withProgress(
          progressOptions,
          async () => {
            const results = [];
            for (const project of projects) {
              const analysis =
                await this.packageSizeService.getTotalDependenciesSize(
                  project.path,
                );
              results.push({
                projectName: project.name,
                totalSize: analysis.totalSize,
                packages: analysis.packages,
              });
            }
            return results;
          },
        );

        const panel = vscode.window.createWebviewPanel(
          "dependencySizeAnalysis",
          "Projects Dependencies Size Analysis",
          vscode.ViewColumn.One,
          {
            enableScripts: true,
            localResourceRoots: [],
          },
        );

        const tabsHtml = allAnalysis
          .map(
            (result, index) =>
              `<button class="tab-button ${index === 0 ? "active" : ""}" onclick="openTab(event, 'tab-${index}')">${result.projectName}</button>`,
          )
          .join("");

        const contentPromises = allAnalysis.map((result, index) => {
          const sizeCategories = this.categorizeDependenciesBySize(
            result.packages,
          );
          return this.generateDetailedDependencyReportHtml(
            result.projectName,
            this.packageSizeService.formatSize(result.totalSize),
            result.packages,
            sizeCategories,
          ).then(
            (html) => `
            <div id="tab-${index}" class="tab-content ${index === 0 ? "active" : ""}">
              ${html}
            </div>
          `,
          );
        });

        const contentHtml = await Promise.all(contentPromises);

        panel.webview.html = `
          <!DOCTYPE html>
          <html lang="en">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Projects Dependencies Size Analysis</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
                padding: 20px;
                color: var(--vscode-foreground);
                background-color: var(--vscode-editor-background);
              }
              .tab-buttons {
                display: flex;
                gap: 5px;
                margin-bottom: 15px;
              }
              .tab-button {
                padding: 8px 15px;
                cursor: pointer;
                background-color: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
                border: none;
                border-radius: 3px;
              }
              .tab-button.active {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
              }
              .tab-content {
                display: none;
              }
              .tab-content.active {
                display: block;
              }
            </style>
          </head>
          <body>
            <div class="tab-buttons">
              ${tabsHtml}
            </div>
            ${contentHtml.join("")}
            <script>
              function openTab(evt, tabName) {
                const tabContents = document.getElementsByClassName('tab-content');
                for (let i = 0; i < tabContents.length; i++) {
                  tabContents[i].classList.remove('active');
                }

                const tabButtons = document.getElementsByClassName('tab-button');
                for (let i = 0; i < tabButtons.length; i++) {
                  tabButtons[i].classList.remove('active');
                }

                document.getElementById(tabName).classList.add('active');
                evt.currentTarget.classList.add('active');
              }
            </script>
          </body>
          </html>
        `;
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to analyze dependencies sizes for all projects: ${error}`,
        );
      }
      return;
    }

    // If a specific project path is provided, analyze only that project
    let projectPath = info?.path;

    if (!projectPath) {
      if (projects && projects.length > 0) {
        const selectedProject = await vscode.window.showQuickPick(
          projects.map((project) => ({
            label: project.name,
            description: project.path,
          })),
          {
            placeHolder: "Select a project to analyze dependencies",
          },
        );

        if (!selectedProject) {
          vscode.window.showErrorMessage("No project selected for analysis");
          return;
        }

        projectPath = selectedProject.description;
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

      const projectName = vscode.workspace.asRelativePath(projectPath);

      // Create and show webview with enhanced visualization
      const panel = vscode.window.createWebviewPanel(
        "dependencySizeAnalysis",
        `Dependencies Size Analysis: ${projectName}`,
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [],
        },
      );

      // Group packages by size categories
      const sizeCategories = this.categorizeDependenciesBySize(
        analysis.packages,
      );

      // Generate HTML with interactive elements and better visualization
      panel.webview.html = await this.generateDetailedDependencyReportHtml(
        projectName,
        formattedTotalSize,
        analysis.packages,
        sizeCategories,
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to analyze dependencies sizes: ${error}`,
      );
    }
  }

  /**
   * Categorizes dependencies by their size into different groups
   */
  private categorizeDependenciesBySize(
    packages: { name: string; size: number; files: number }[],
  ) {
    const huge = packages.filter((pkg) => pkg.size >= 10 * 1024 * 1024); // >= 10MB
    const large = packages.filter(
      (pkg) => pkg.size >= 1 * 1024 * 1024 && pkg.size < 10 * 1024 * 1024,
    ); // 1MB-10MB
    const medium = packages.filter(
      (pkg) => pkg.size >= 100 * 1024 && pkg.size < 1 * 1024 * 1024,
    ); // 100KB-1MB
    const small = packages.filter((pkg) => pkg.size < 100 * 1024); // < 100KB

    return { huge, large, medium, small };
  }

  /**
   * Generates detailed HTML report with interactive elements for dependency analysis
   */
  private async generateDetailedDependencyReportHtml(
    projectName: string,
    totalSize: string,
    packages: { name: string; size: number; files: number }[],
    sizeCategories: {
      huge: { name: string; size: number; files: number }[];
      large: { name: string; size: number; files: number }[];
      medium: { name: string; size: number; files: number }[];
      small: { name: string; size: number; files: number }[];
    },
  ): Promise<string> {
    // Calculate percentages for visualization
    const totalBytes = packages.reduce((acc, pkg) => acc + pkg.size, 0);

    // Generate top packages content
    const topPackages = packages.slice(0, 10);
    let topPackagesContent = "";
    topPackages.forEach((pkg) => {
      const percentage = ((pkg.size / totalBytes) * 100).toFixed(1);
      const formattedSize = this.packageSizeService.formatSize(pkg.size);
      topPackagesContent += `
        <div class="package-bar">
          <div class="package-name">${pkg.name}</div>
          <div class="progress-container">
            <div class="progress-bar" style="width: ${percentage}%"></div>
            <div class="size-label">${formattedSize} (${percentage}%)</div>
          </div>
        </div>
      `;
    });

    // Read the template file using VS Code API
    const templateBuffer = await vscode.workspace.fs.readFile(this.templateUri);
    const template = new TextDecoder().decode(templateBuffer);

    // Generate tables for each category
    const generateTable = (
      packages: { name: string; size: number; files: number }[],
    ) => {
      if (!packages.length) {
        return '<table><tr><td colspan="4">No packages in this category</td></tr></table>';
      }

      const rows = packages
        .map(
          (pkg, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${pkg.name}</td>
          <td>${this.packageSizeService.formatSize(pkg.size)}</td>
          <td>${pkg.files}</td>
        </tr>
      `,
        )
        .join("");

      return `
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Package</th>
              <th>Size</th>
              <th>Files</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;
    };

    // Replace placeholders in the template
    return template
      .replace("{{projectName}}", projectName)
      .replace("{{totalSize}}", totalSize)
      .replace("{{totalPackages}}", packages.length.toString())
      .replace("{{largestPackageName}}", packages[0]?.name || "N/A")
      .replace(
        "{{largestPackageSize}}",
        packages[0] ? this.packageSizeService.formatSize(packages[0].size) : "",
      )
      .replace("{{topPackagesContent}}", topPackagesContent)
      .replace("{{hugePackagesTable}}", generateTable(sizeCategories.huge))
      .replace("{{largePackagesTable}}", generateTable(sizeCategories.large))
      .replace("{{mediumPackagesTable}}", generateTable(sizeCategories.medium))
      .replace("{{smallPackagesTable}}", generateTable(sizeCategories.small))
      .replace("{{allPackagesTable}}", generateTable(packages));
  }
}
