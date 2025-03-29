import * as vscode from "vscode";
import { TaskService } from "../services/TaskService";

export class TaskWebView {
  public static readonly viewType = "taskEditor";
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];
  private workspaceFolder?: vscode.WorkspaceFolder =
    vscode.workspace.getWorkspaceFolder(vscode.Uri.file(process.cwd()));

  constructor(
    extensionUri: vscode.Uri,
    private taskService: TaskService,
    private projectPaths?: string[],
  ) {
    this._extensionUri = extensionUri;

    this._panel = vscode.window.createWebviewPanel(
      TaskWebView.viewType,
      "Task Editor",
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
        title: "Loading task editor...",
        cancellable: false,
      },
      async () => {
        await this._initializeWebview();

        // Initialize the form with project paths
        this._panel.webview.postMessage({
          type: "init",
          task: null,
          projectPaths: this.projectPaths || [],
        });
      },
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case "save":
            await this._handleSaveTask(message.task);
            break;
          case "cancel":
            this._panel.dispose();
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
        `Failed to initialize task editor: ${error}`,
      );
      this._panel.dispose();
    }
  }

  private async _handleSaveTask(taskData: vscode.TaskDefinition) {
    try {
      // Ensure we have a valid workspace folder
      if (!this.workspaceFolder) {
        // Try to select a workspace folder
        this.workspaceFolder = await this._selectWorkspaceFolder();

        // If still no workspace folder, we can't continue
        if (!this.workspaceFolder) {
          vscode.window.showErrorMessage(
            "No workspace folder selected. Task cannot be saved without a valid workspace folder.",
          );
          return;
        }
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Creating task...",
          cancellable: false,
        },
        async () => {
          // Create new task with workspace folder
          await this.taskService.createTask(taskData, this.workspaceFolder);
          vscode.window.showInformationMessage(
            `Task "${taskData.label}" created successfully`,
          );
        },
      );
      this._panel.dispose();
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to save task: ${error}`);
    }
  }

  private async _selectWorkspaceFolder(): Promise<
    vscode.WorkspaceFolder | undefined
  > {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders) {
      vscode.window.showErrorMessage("No workspace folders are open");
      return undefined;
    }

    if (workspaceFolders.length === 1) {
      return workspaceFolders[0];
    }

    return await vscode.window.showWorkspaceFolderPick({
      placeHolder: "Select a workspace folder for the task",
    });
  }

  private async _getHtmlForWebview(): Promise<string> {
    const templatePath = vscode.Uri.joinPath(
      this._extensionUri,
      "src",
      "views",
      "templates",
      "taskEditor.html",
    );

    try {
      const fileContent = await vscode.workspace.fs.readFile(templatePath);
      const templateContent = new TextDecoder().decode(fileContent);

      const webview = this._panel.webview;

      // Update content security policy
      return templateContent.replace(
        /<head>/i,
        `<head>
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-inline';">`,
      );
    } catch (error) {
      console.error("Failed to read template:", error);
      throw new Error("Failed to load editor template");
    }
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
