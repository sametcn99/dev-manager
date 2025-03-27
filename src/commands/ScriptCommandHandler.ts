import * as vscode from "vscode";
import { ProjectTreeProvider } from "../providers/ProjectTreeProvider";

export class ScriptCommandHandler {
  constructor(private projectTreeProvider: ProjectTreeProvider) {}

  public registerCommands(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "dev-manager.runScript",
        this.handleRunScript.bind(this),
      ),
    );
  }

  private async handleRunScript(info: { path: string; script: string }) {
    if (!info?.path || !info?.script) {
      return;
    }

    const terminal = vscode.window.createTerminal(`Script: ${info.script}`);
    terminal.show();
    terminal.sendText(`cd "${info.path}" && npm run ${info.script}`);
  }
}
