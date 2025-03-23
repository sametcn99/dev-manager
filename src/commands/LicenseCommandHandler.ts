import * as vscode from "vscode";
import { ProjectTreeProvider } from "../providers/ProjectTreeProvider";

export class LicenseCommandHandler {
  private readonly LICENSE_URLS: Record<string, string> = {
    MIT: "https://spdx.org/licenses/MIT.txt",
    "Apache-2.0": "https://spdx.org/licenses/Apache-2.0.txt",
    "GPL-3.0": "https://spdx.org/licenses/GPL-3.0-only.txt",
    "BSD-3-Clause": "https://spdx.org/licenses/BSD-3-Clause.txt",
    ISC: "https://spdx.org/licenses/ISC.txt",
    Unlicense: "https://spdx.org/licenses/Unlicense.txt",
  };

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
      const currentYear = new Date().getFullYear();
      return content
        .trim()
        .replace(/\r\n/g, "\n")
        .replace(/\[year\]/gi, currentYear.toString())
        .replace(/\[yyyy\]/gi, currentYear.toString())
        .replace(/<year>/gi, currentYear.toString())
        .replace(/\[name of copyright owner\]/gi, "[NAME]")
        .replace(/<name of author>/gi, "[NAME]")
        .replace(/\[fullname\]/gi, "[NAME]")
        .replace(/<copyright holders>/gi, "[NAME]")
        .replace(/<copyright holder>/gi, "[NAME]")
        .replace(/{{year}}/gi, currentYear.toString())
        .replace(/{{fullname}}/gi, "[NAME]")
        .trim();
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
      "BSD-3-Clause",
      "ISC",
      "Unlicense",
      "Custom...",
    ];

    const items = licenses.map((license) => ({
      label: license,
      description: license === info.currentLicense ? "Current" : undefined,
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

      // Get author name from package.json or prompt user
      const authorName =
        typeof packageJson.author === "string"
          ? packageJson.author
          : packageJson.author?.name || (await this.promptForAuthorName());

      packageJson.license = newLicense;

      // First update package.json
      await vscode.workspace.fs.writeFile(
        packageJsonUri,
        Buffer.from(JSON.stringify(packageJson, null, 2)),
      );

      // Now handle the LICENSE file
      if (this.LICENSE_URLS[newLicense]) {
        try {
          const licenseContent = await this.fetchLicenseTemplate(newLicense);
          if (licenseContent) {
            const licenseFileUri = vscode.Uri.joinPath(projectUri, "LICENSE");
            const finalContent = licenseContent.replace(
              /\[NAME\]/g,
              authorName,
            );

            // Create or update the LICENSE file
            await vscode.workspace.fs.writeFile(
              licenseFileUri,
              Buffer.from(finalContent, "utf-8"),
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
      }

      this.projectTreeProvider.refresh();
      vscode.window.showInformationMessage(
        `Project license updated to: ${newLicense}`,
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to update license: ${error}`);
    }
  }

  private async promptForAuthorName(): Promise<string> {
    const name = await vscode.window.showInputBox({
      prompt: "Enter the copyright holder's name",
      placeHolder: "Your Name",
      value: "Your Name",
    });
    return name || "Your Name";
  }
}
