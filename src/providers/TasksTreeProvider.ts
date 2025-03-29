import * as vscode from "vscode";
import { TaskService } from "../services/TaskService";
import { TaskTreeItem } from "../views/TreeItems";

export class TasksTreeProvider
  implements vscode.TreeDataProvider<vscode.TreeItem>
{
  private _onDidChangeTreeData = new vscode.EventEmitter<
    vscode.TreeItem | undefined
  >();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private taskService: TaskService) {}

  refresh(element?: vscode.TreeItem): void {
    this._onDidChangeTreeData.fire(element);
  }

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: vscode.TreeItem): Promise<vscode.TreeItem[]> {
    if (!element) {
      const tasks = await this.taskService.getTasks();
      return tasks.map((task) => new TaskTreeItem(task));
    }
    return [];
  }
}
