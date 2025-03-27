import * as vscode from "vscode";

export class TaskService {
  private configFilePath: string;

  constructor() {
    // Get workspace root
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error("No workspace folder found");
    }
    this.configFilePath = vscode.Uri.joinPath(
      workspaceFolder.uri,
      "dev-manager.json",
    ).fsPath;
  }

  public async getConfig(): Promise<DevManagerConfig> {
    try {
      const configUri = vscode.Uri.file(this.configFilePath);
      const content = await vscode.workspace.fs.readFile(configUri);
      return JSON.parse(content.toString());
    } catch (error) {
      // Return empty config if file doesn't exist
      return {};
    }
  }

  public async saveConfig(config: DevManagerConfig): Promise<void> {
    const configUri = vscode.Uri.file(this.configFilePath);
    await vscode.workspace.fs.writeFile(
      configUri,
      Buffer.from(JSON.stringify(config, null, 2)),
    );
  }

  public async getTasks(): Promise<TaskConfig[]> {
    const config = await this.getConfig();
    return config.tasks || [];
  }

  public async addTask(task: TaskConfig): Promise<void> {
    const config = await this.getConfig();
    const tasks = config.tasks || [];
    tasks.push(task);
    await this.saveConfig({ ...config, tasks });
  }

  public async updateTask(
    taskName: string,
    updatedTask: TaskConfig,
  ): Promise<void> {
    const config = await this.getConfig();
    const tasks = config.tasks || [];
    const index = tasks.findIndex((t) => t.name === taskName);
    if (index !== -1) {
      tasks[index] = updatedTask;
      await this.saveConfig({ ...config, tasks });
    }
  }

  public async deleteTask(taskName: string): Promise<void> {
    const config = await this.getConfig();
    const tasks = config.tasks || [];
    const filteredTasks = tasks.filter((t) => t.name !== taskName);
    await this.saveConfig({ ...config, tasks: filteredTasks });
  }

  public async runTask(task: TaskConfig): Promise<void> {
    const terminal = vscode.window.createTerminal(`Task: ${task.name}`);
    terminal.show();

    // Use cwd if specified, otherwise use workspace root
    const cwd = task.cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (cwd) {
      terminal.sendText(`cd "${cwd}"`);
    }

    terminal.sendText(task.command);
  }
}
