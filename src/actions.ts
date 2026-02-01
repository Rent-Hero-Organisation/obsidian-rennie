import { App, TFile, Notice } from "obsidian";
import { OpenClawAction } from "./types";

export class ActionExecutor {
  constructor(private app: App) {}

  async execute(actions: OpenClawAction[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const action of actions) {
      try {
        await this.executeOne(action);
        success++;
      } catch (err) {
        console.error("Action failed:", action, err);
        failed++;
      }
    }

    if (success > 0) {
      new Notice(`OpenClaw: ${success} action(s) completed`);
    }
    if (failed > 0) {
      new Notice(`OpenClaw: ${failed} action(s) failed`);
    }

    return { success, failed };
  }

  private async executeOne(action: OpenClawAction): Promise<void> {
    const { vault } = this.app;

    switch (action.action) {
      case "createFile": {
        const exists = vault.getAbstractFileByPath(action.path);
        if (exists) {
          throw new Error(`File already exists: ${action.path}`);
        }
        await vault.create(action.path, action.content);
        break;
      }

      case "updateFile": {
        const file = vault.getAbstractFileByPath(action.path);
        if (!(file instanceof TFile)) {
          throw new Error(`File not found: ${action.path}`);
        }
        await vault.modify(file, action.content);
        break;
      }

      case "appendToFile": {
        const file = vault.getAbstractFileByPath(action.path);
        if (!(file instanceof TFile)) {
          throw new Error(`File not found: ${action.path}`);
        }
        const current = await vault.read(file);
        await vault.modify(file, current + "\n" + action.content);
        break;
      }

      case "deleteFile": {
        const file = vault.getAbstractFileByPath(action.path);
        if (!file) {
          throw new Error(`File not found: ${action.path}`);
        }
        await vault.delete(file);
        break;
      }

      case "renameFile": {
        const file = vault.getAbstractFileByPath(action.path);
        if (!file) {
          throw new Error(`File not found: ${action.path}`);
        }
        await vault.rename(file, action.newPath);
        break;
      }

      case "openFile": {
        const file = vault.getAbstractFileByPath(action.path);
        if (!(file instanceof TFile)) {
          throw new Error(`File not found: ${action.path}`);
        }
        await this.app.workspace.getLeaf().openFile(file);
        break;
      }

      default:
        throw new Error(`Unknown action: ${(action as OpenClawAction).action}`);
    }
  }
}
