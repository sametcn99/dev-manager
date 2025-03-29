import * as vscode from "vscode";
import { ProjectTreeProvider } from "../providers/ProjectTreeProvider";
import {
  DependencyAnalysisResult,
  PackageSizeService,
} from "../services/PackageSizeService";
import { PackageSizeWebView } from "../views/PackageSizeWebView";
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
              try {
                // Check if node_modules exists first
                const nodeModulesExists =
                  await this.packageSizeService.checkNodeModulesExists(
                    project.path,
                  );

                let analysis: DependencyAnalysisResult;
                if (nodeModulesExists) {
                  // If node_modules exists, get the analysis as usual
                  analysis =
                    await this.packageSizeService.getTotalDependenciesSize(
                      project.path,
                    );
                } else {
                  // If node_modules doesn't exist, create an empty result with dependenciesInstalled=false
                  analysis = {
                    totalSize: 0,
                    packages: [],
                    dependenciesInstalled: false,
                  };
                }

                results.push({
                  projectName: project.name,
                  path: project.path,
                  analysis: analysis,
                });
              } catch (error) {
                // Handle errors for individual projects without failing the entire operation
                console.error(
                  `Error analyzing project ${project.name}: ${error}`,
                );

                // Add an empty result for this project
                results.push({
                  projectName: project.name,
                  path: project.path,
                  analysis: {
                    totalSize: 0,
                    packages: [],
                    dependenciesInstalled: false,
                  },
                });
              }
            }
            return results;
          },
        );

        // Create new WebView using the PackageSizeWebView class for each project
        const panels: PackageSizeWebView[] = [];

        for (const result of allAnalysis) {
          panels.push(
            new PackageSizeWebView(
              this.context.extensionUri,
              this.packageSizeService,
              result.path,
              result.analysis,
            ),
          );
        }
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

    const progressOptions = {
      location: vscode.ProgressLocation.Notification,
      title: "Analyzing package sizes...",
      cancellable: false,
    };

    try {
      // First, check if node_modules exists
      const nodeModulesExists =
        await this.packageSizeService.checkNodeModulesExists(projectPath);

      let analysis: DependencyAnalysisResult;
      if (nodeModulesExists) {
        // If node_modules exists, proceed as usual
        analysis = await vscode.window.withProgress(progressOptions, () =>
          this.packageSizeService.getTotalDependenciesSize(projectPath!),
        );
      } else {
        // If node_modules doesn't exist, create an empty result with dependenciesInstalled=false
        analysis = {
          totalSize: 0,
          packages: [],
          dependenciesInstalled: false,
        };
      }

      const projectName = vscode.workspace.asRelativePath(projectPath);

      // Use the new PackageSizeWebView class
      new PackageSizeWebView(
        this.context.extensionUri,
        this.packageSizeService,
        projectName,
        analysis,
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
   *
   * @deprecated Use PackageSizeWebView class instead
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
    projectIndex?: number,
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

    let html = template;

    // If projectIndex is provided, update IDs and onclick handlers for multiple project view
    if (typeof projectIndex === "number") {
      html = html
        .replace(
          /id="(huge|large|medium|small|all)"/g,
          (match, id) => `id="${id}-${projectIndex}"`,
        )
        .replace(
          /onclick="openTab\(event,\s*'(huge|large|medium|small|all)'\)"/g,
          (match, id) =>
            `onclick="openSizeTab(event, '${id}', ${projectIndex})" class="size-tab-button"`,
        )
        .replace(/class="tab-content/g, 'class="size-tab-content');
    }

    // Replace placeholders in the template
    return html
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
