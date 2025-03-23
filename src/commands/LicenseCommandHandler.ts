import * as vscode from "vscode";
import { ProjectTreeProvider } from "../providers/ProjectTreeProvider";

export class LicenseCommandHandler {
  constructor(private projectTreeProvider: ProjectTreeProvider) {}

  public registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dev-manager.changeLicense",
        this.handleChangeLicense.bind(this),
      ),
    );
  }

  private async fetchLicenseTemplate(
    license: string,
  ): Promise<string | undefined> {
    try {
      const { Octokit } = await import("@octokit/rest");
      const octokit = new Octokit();
      const response = await octokit.licenses.get({ license });

      if (!response || !response.data || !response.data.body) {
        console.error(
          `No content returned from Octokit for license: ${license}`,
        );
        return undefined;
      }

      const content = response.data.body;

      return content;
    } catch (error) {
      console.error(
        `Error fetching license template for ${license} using Octokit: ${error}`,
      );
      return undefined;
    }
  }

  private async handleChangeLicense(info: {
    path: string;
    currentLicense?: string;
  }): Promise<void> {
    const licenses = [
      "MIT",
      "Apache-2.0",
      "GPL-3.0",
      "GPL-2.0",
      "LGPL-3.0",
      "LGPL-2.1",
      "BSD-3-Clause",
      "BSD-2-Clause",
      "ISC",
      "MPL-2.0",
      "AGPL-3.0",
      "EPL-2.0",
      "CC0-1.0",
      "Unlicense",
      "WTFPL",
      "BSL-1.0",
      "Artistic-2.0",
      "Zlib",
      "Custom...",
    ];

    // Sort licenses alphabetically except keep Custom... at the end
    const sortedLicenses = licenses
      .filter((l) => l !== "Custom...")
      .sort()
      .concat(["Custom..."]);

    const items = sortedLicenses.map((license) => ({
      label: license,
      description: license === info.currentLicense ? "Current" : undefined,
      // Add details about the license type
      detail: this.getLicenseDescription(license),
    }));

    const selected = await vscode.window.showQuickPick(items, {
      title: "Select Project License",
      placeHolder: `Current: ${info.currentLicense || "Not specified"}`,
    });

    if (!selected) {
      return;
    }

    let newLicense = selected.label;
    if (newLicense === "Custom...") {
      const custom = await vscode.window.showInputBox({
        prompt: "Enter custom license identifier",
        value: info.currentLicense || "",
      });
      if (!custom) {
        return;
      }
      newLicense = custom;
    }

    try {
      const projectUri = vscode.Uri.file(info.path);
      const packageJsonUri = vscode.Uri.joinPath(projectUri, "package.json");
      const content = await vscode.workspace.fs.readFile(packageJsonUri);
      const packageJson = JSON.parse(content.toString());

      packageJson.license = newLicense;

      // First update package.json
      await vscode.workspace.fs.writeFile(
        packageJsonUri,
        Buffer.from(JSON.stringify(packageJson, null, 2)),
      );

      // Now handle the LICENSE file
      try {
        const licenseContent = await this.fetchLicenseTemplate(newLicense);
        if (licenseContent) {
          const licenseFileUri = vscode.Uri.joinPath(projectUri, "LICENSE");

          // Create or update the LICENSE file
          await vscode.workspace.fs.writeFile(
            licenseFileUri,
            Buffer.from(licenseContent, "utf-8"),
          );

          vscode.window.showInformationMessage(
            `License file created/updated with ${newLicense} template`,
          );
        } else {
          throw new Error("Could not fetch license content");
        }
      } catch (error) {
        vscode.window.showWarningMessage(
          `Could not create LICENSE file: ${error}. Only package.json has been updated.`,
        );
      }

      this.projectTreeProvider.refresh();
      vscode.window.showInformationMessage(
        `Project license updated to: ${newLicense}`,
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update license: ${error}`);
    }
  }

  private getLicenseDescription(license: string): string {
    const descriptions: Record<string, string> = {
      MIT: "Permissive, short and simple, allows commercial use, modification, and distribution",
      "Apache-2.0":
        "Permissive with patent rights grant, suitable for enterprise use",
      "GPL-3.0": "Strong copyleft, requires derivative works to be open source",
      "GPL-2.0": "Earlier version of GPL, widely used in Linux kernel",
      "LGPL-3.0": "Weak copyleft, allows linking with proprietary software",
      "LGPL-2.1": "Earlier version of LGPL, commonly used for libraries",
      "BSD-3-Clause": "Permissive, requires attribution and non-endorsement",
      "BSD-2-Clause": "Simplified BSD, more permissive than 3-clause",
      ISC: "Simplified BSD/MIT, preferred by Node.js projects",
      "MPL-2.0": "Mozilla license, file-level copyleft, patent rights",
      "AGPL-3.0": "Strong copyleft, covers network use (e.g., web services)",
      "EPL-2.0": "Eclipse license, weak copyleft with patent grants",
      "CC0-1.0": "Public domain dedication, maximum freedom",
      Unlicense: "Public domain waiver, no conditions",
      WTFPL: "Do What The F* You Want To Public License, minimal restrictions",
      "BSL-1.0": "Boost Software License, simple and permissive",
      "Artistic-2.0": "Perl Foundation license, balances openness and control",
      Zlib: "Simple permissive license used by zlib",
      "Custom...": "Enter a custom license identifier",
    };

    return descriptions[license] || "No description available";
  }
}
