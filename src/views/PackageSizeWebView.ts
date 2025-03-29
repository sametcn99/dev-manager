import * as vscode from "vscode";
import { PackageSizeService } from "../services/PackageSizeService";

export class PackageSizeWebView {
  public static readonly viewType = "packageSizeAnalysis";
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  constructor(
    extensionUri: vscode.Uri,
    private packageSizeService: PackageSizeService,
    private projectName: string,
    private analysis: {
      totalSize: number;
      packages: { name: string; size: number; files: number }[];
    },
  ) {
    this._extensionUri = extensionUri;

    this._panel = vscode.window.createWebviewPanel(
      PackageSizeWebView.viewType,
      `Dependencies Size Analysis: ${projectName}`,
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
          projectName: this.projectName,
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
        .replace("{{projectName}}", this.projectName)
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
