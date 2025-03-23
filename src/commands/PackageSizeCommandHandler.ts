import * as vscode from "vscode";
import * as path from "path";
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

      const projectName = path.basename(projectPath);

      // Create and show webview with enhanced visualization
      const panel = vscode.window.createWebviewPanel(
        "dependencySizeAnalysis",
        "Dependencies Size Analysis",
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
      panel.webview.html = this.generateDetailedDependencyReportHtml(
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
  private generateDetailedDependencyReportHtml(
    projectName: string,
    totalSize: string,
    packages: { name: string; size: number; files: number }[],
    sizeCategories: {
      huge: { name: string; size: number; files: number }[];
      large: { name: string; size: number; files: number }[];
      medium: { name: string; size: number; files: number }[];
      small: { name: string; size: number; files: number }[];
    },
  ): string {
    // Calculate percentages for visualization
    const totalBytes = packages.reduce((acc, pkg) => acc + pkg.size, 0);

    // Generate top packages HTML (top 10)
    const topPackages = packages.slice(0, 10);
    let topPackagesHtml = "";
    topPackages.forEach((pkg) => {
      const percentage = ((pkg.size / totalBytes) * 100).toFixed(1);
      const formattedSize = this.packageSizeService.formatSize(pkg.size);
      topPackagesHtml += `
        <div class="package-bar">
          <div class="package-name">${pkg.name}</div>
          <div class="progress-container">
            <div class="progress-bar" style="width: ${percentage}%"></div>
            <div class="size-label">${formattedSize} (${percentage}%)</div>
          </div>
        </div>
      `;
    });

    // Generate category tables
    const categoryHtml = this.generateCategoryTablesHtml(sizeCategories);

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dependencies Size Analysis</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif; 
            padding: 20px;
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
          }
          h1, h2, h3 { 
            color: var(--vscode-editor-foreground);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 10px;
          }
          .project-info {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
          }
          .summary {
            display: flex;
            gap: 20px;
            flex-wrap: wrap;
          }
          .summary-item {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            padding: 15px;
            border-radius: 4px;
            flex: 1;
            min-width: 200px;
            text-align: center;
          }
          .package-bar {
            margin-bottom: 10px;
          }
          .package-name {
            margin-bottom: 3px;
            font-weight: 500;
          }
          .progress-container {
            background-color: var(--vscode-editorWidget-background);
            height: 24px;
            border-radius: 4px;
            position: relative;
            overflow: hidden;
          }
          .progress-bar {
            background-color: var(--vscode-progressBar-background);
            height: 100%;
            transition: width 0.3s ease;
          }
          .size-label {
            position: absolute;
            right: 10px;
            top: 3px;
            font-size: 12px;
            color: var(--vscode-editor-foreground);
          }
          .tab-container {
            margin-top: 30px;
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
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            text-align: left;
            padding: 12px 15px;
            border-bottom: 1px solid var(--vscode-panel-border);
          }
          th {
            background-color: var(--vscode-editorWidget-background);
            position: sticky;
            top: 0;
          }
          .small-text {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
          }
        </style>
      </head>
      <body>
        <div class="project-info">
          <h1>Dependency Analysis: ${projectName}</h1>
          <div class="summary">
            <div class="summary-item">
              <h3>Total Size</h3>
              <div style="font-size: 24px">${totalSize}</div>
            </div>
            <div class="summary-item">
              <h3>Total Packages</h3>
              <div style="font-size: 24px">${packages.length}</div>
            </div>
            <div class="summary-item">
              <h3>Largest Package</h3>
              <div style="font-size: 24px">${packages[0]?.name || "N/A"}</div>
              <div class="small-text">${packages[0] ? this.packageSizeService.formatSize(packages[0].size) : ""}</div>
            </div>
          </div>
        </div>
        
        <h2>Top Dependencies by Size</h2>
        <div class="top-packages">
          ${topPackagesHtml}
        </div>
        
        <div class="tab-container">
          <h2>Package Size Categories</h2>
          <div class="tab-buttons">
            <button class="tab-button active" onclick="openTab(event, 'huge')">Huge (≥10MB)</button>
            <button class="tab-button" onclick="openTab(event, 'large')">Large (1MB-10MB)</button>
            <button class="tab-button" onclick="openTab(event, 'medium')">Medium (100KB-1MB)</button>
            <button class="tab-button" onclick="openTab(event, 'small')">Small (<100KB)</button>
            <button class="tab-button" onclick="openTab(event, 'all')">All Packages</button>
          </div>
          
          ${categoryHtml}
        </div>
        
        <script>
          function openTab(evt, tabName) {
            // Hide all tab content
            const tabContents = document.getElementsByClassName('tab-content');
            for (let i = 0; i < tabContents.length; i++) {
              tabContents[i].classList.remove('active');
            }
            
            // Remove active class from all tab buttons
            const tabButtons = document.getElementsByClassName('tab-button');
            for (let i = 0; i < tabButtons.length; i++) {
              tabButtons[i].classList.remove('active');
            }
            
            // Show current tab and add active class to button
            document.getElementById(tabName).classList.add('active');
            evt.currentTarget.classList.add('active');
          }
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Generates HTML for each size category table
   */
  private generateCategoryTablesHtml(categories: {
    huge: { name: string; size: number; files: number }[];
    large: { name: string; size: number; files: number }[];
    medium: { name: string; size: number; files: number }[];
    small: { name: string; size: number; files: number }[];
  }): string {
    // Generate tables for each category
    const generateTable = (
      packages: { name: string; size: number; files: number }[],
    ) => {
      let tableRows = "";
      packages.forEach((pkg, index) => {
        const formattedSize = this.packageSizeService.formatSize(pkg.size);
        tableRows += `
          <tr>
            <td>${index + 1}</td>
            <td>${pkg.name}</td>
            <td>${formattedSize}</td>
            <td>${pkg.files}</td>
          </tr>
        `;
      });

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
            ${tableRows || '<tr><td colspan="4">No packages in this category</td></tr>'}
          </tbody>
        </table>
      `;
    };

    // Generate all packages table
    const allPackages = [
      ...categories.huge,
      ...categories.large,
      ...categories.medium,
      ...categories.small,
    ];

    return `
      <div id="huge" class="tab-content active">
        ${generateTable(categories.huge)}
      </div>
      <div id="large" class="tab-content">
        ${generateTable(categories.large)}
      </div>
      <div id="medium" class="tab-content">
        ${generateTable(categories.medium)}
      </div>
      <div id="small" class="tab-content">
        ${generateTable(categories.small)}
      </div>
      <div id="all" class="tab-content">
        ${generateTable(allPackages)}
      </div>
    `;
  }
}
