import * as vscode from "vscode";
import {
  DependencyAnalysisResult,
  PackageSizeService,
} from "../services/PackageSizeService";

export class PackageSizeWebView {
  public static readonly viewType = "packageSizeAnalysis";
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private readonly _projectPath: string;
  private readonly _projectName: string;

  constructor(
    extensionUri: vscode.Uri,
    private packageSizeService: PackageSizeService,
    projectPath: string,
    private analysis: DependencyAnalysisResult,
  ) {
    this._extensionUri = extensionUri;
    this._projectPath = projectPath;
    this._projectName = vscode.workspace.asRelativePath(projectPath);

    this._panel = vscode.window.createWebviewPanel(
      PackageSizeWebView.viewType,
      `Dependencies Size Analysis: ${this._projectName}`,
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, "src", "views", "templates"),
        ],
      },
    );

    // Initialize the webview content with progress indicator
    vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Loading package size analysis...",
        cancellable: false,
      },
      async () => {
        await this._initializeWebview();

        // Send data to the webview
        this._panel.webview.postMessage({
          command: "updateData",
          projectName: this._projectName,
          analysis: this.analysis,
        });
      },
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "openPackageDetails":
            await this._handleOpenPackageDetails(message.packageName);
            break;
          case "installDependencies":
            await this._handleInstallDependencies();
            break;
        }
      },
      null,
      this._disposables,
    );
  }

  private async _initializeWebview() {
    try {
      this._panel.webview.html = await this._getHtmlForWebview();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to initialize package size analysis: ${error}`,
      );
      this._panel.dispose();
    }
  }

  private async _handleOpenPackageDetails(packageName: string) {
    // This could be implemented later to show detailed information about a specific package
    vscode.window.showInformationMessage(
      `Detailed analysis for package: ${packageName} coming soon!`,
    );
  }

  private async _handleInstallDependencies() {
    // Open integrated terminal and run npm install for the project
    const terminal = vscode.window.createTerminal(
      `Install Dependencies: ${this._projectName}`,
    );
    terminal.show();

    // Use the stored project path
    terminal.sendText(`cd "${this._projectPath}"`);
    terminal.sendText("npm install");

    vscode.window.showInformationMessage(
      "Installing dependencies. This might take a while. Please refresh the analysis after installation is complete.",
    );
  }

  private async _getHtmlForWebview(): Promise<string> {
    const templatePath = vscode.Uri.joinPath(
      this._extensionUri,
      "src",
      "views",
      "templates",
      "packageSizeAnalysis.html",
    );

    try {
      const fileContent = await vscode.workspace.fs.readFile(templatePath);
      const templateContent = new TextDecoder().decode(fileContent);

      const webview = this._panel.webview;

      // Check if dependencies are installed
      if (!this.analysis.dependenciesInstalled) {
        // Return a template with a message indicating dependencies need to be installed
        return this._getNoDependenciesHtml(templateContent, webview);
      }

      // Calculate percentages for visualization
      const totalBytes = this.analysis.packages.reduce(
        (acc, pkg) => acc + pkg.size,
        0,
      );
      const formattedTotalSize = this.packageSizeService.formatSize(totalBytes);

      // Generate top packages content
      const topPackages = this.analysis.packages.slice(0, 10);
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

      // Group packages by size categories
      const sizeCategories = this._categorizeDependenciesBySize(
        this.analysis.packages,
      );

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

      // Generate dependencies and dev dependencies content
      const dependenciesContent = this._generateDependenciesContent(
        this.analysis.packages,
        false,
      );
      const devDependenciesContent = this._generateDependenciesContent(
        this.analysis.packages,
        true,
      );

      // Replace placeholders in the template
      let html = templateContent
        .replace("{{projectName}}", this._projectName)
        .replace("{{totalSize}}", formattedTotalSize)
        .replace("{{totalPackages}}", this.analysis.packages.length.toString())
        .replace(
          "{{largestPackageName}}",
          this.analysis.packages[0]?.name || "N/A",
        )
        .replace(
          "{{largestPackageSize}}",
          this.analysis.packages[0]
            ? this.packageSizeService.formatSize(this.analysis.packages[0].size)
            : "",
        )
        .replace("{{topPackagesContent}}", topPackagesContent)
        .replace("{{hugePackagesTable}}", generateTable(sizeCategories.huge))
        .replace("{{largePackagesTable}}", generateTable(sizeCategories.large))
        .replace(
          "{{mediumPackagesTable}}",
          generateTable(sizeCategories.medium),
        )
        .replace("{{smallPackagesTable}}", generateTable(sizeCategories.small))
        .replace("{{dependenciesContent}}", dependenciesContent)
        .replace("{{devDependenciesContent}}", devDependenciesContent);

      // Update content security policy
      html = html.replace(
        /<head>/i,
        `<head>
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline';">`,
      );

      return html;
    } catch (error) {
      console.error("Failed to read template:", error);
      throw new Error("Failed to load package size analysis template");
    }
  }

  /**
   * Generates HTML for the case when node_modules does not exist
   */
  private _getNoDependenciesHtml(
    templateContent: string,
    webview: vscode.Webview,
  ): string {
    // Create simplified version of the template with a message
    let html = templateContent;

    // Custom content for when dependencies are not installed
    const noDependenciesContent = `
      <div class="settings-section" style="text-align: center; padding: 50px 20px;">
        <div style="margin-bottom: 30px;">
          <svg width="100" height="100" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="var(--vscode-foreground)" stroke-opacity="0.5" stroke-width="2"/>
            <path d="M12 8V12" stroke="var(--vscode-foreground)" stroke-width="2" stroke-linecap="round"/>
            <circle cx="12" cy="16" r="1" fill="var(--vscode-foreground)"/>
          </svg>
        </div>
        <h2 style="margin-bottom: 16px; color: var(--vscode-foreground);">Dependencies Not Installed</h2>
        <p style="margin-bottom: 30px; color: var(--vscode-descriptionForeground); max-width: 600px; margin-left: auto; margin-right: auto;">
          It appears that node_modules directory does not exist for this project. This typically means dependencies have not been installed yet.
        </p>
        <button id="installDependenciesBtn" class="install-btn" style="padding: 8px 16px; background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 2px; cursor: pointer; font-weight: 600;">
          Install Dependencies
        </button>
      </div>
      <script>
        const vscode = acquireVsCodeApi();
        document.getElementById('installDependenciesBtn').addEventListener('click', () => {
          vscode.postMessage({
            command: 'installDependencies'
          });
        });
      </script>
    `;

    // Replace the content of the main overview section
    html = html.replace(
      /<div id="overview-section"[^>]*>([\s\S]*?)<\/div>\s*<div id="dependencies-section"/,
      `<div id="overview-section" class="settings-section active" data-nav="overview-section">
        <div class="settings-content-header">Dependencies Size Analysis</div>
        ${noDependenciesContent}
      </div>
      <div id="dependencies-section"`,
    );

    // Update content security policy
    html = html.replace(
      /<head>/i,
      `<head>
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline';">`,
    );

    return html;
  }

  /**
   * Categorizes dependencies by their size into different groups
   */
  private _categorizeDependenciesBySize(
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
   * Generates content for dependencies and dev dependencies sections
   */
  private _generateDependenciesContent(
    packages: { name: string; size: number; files: number }[],
    isDevDependency: boolean,
  ): string {
    // In a real implementation, we would filter packages based on whether they are dev dependencies
    // For now, we'll show the same content in both sections
    const filteredPackages = packages.slice(0, isDevDependency ? 5 : 10);

    if (!filteredPackages.length) {
      return `<p>No ${isDevDependency ? "dev " : ""}dependencies found.</p>`;
    }

    const rows = filteredPackages
      .map(
        (pkg) => `
      <tr>
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
  }

  public dispose() {
    this._panel.dispose();
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }
}
