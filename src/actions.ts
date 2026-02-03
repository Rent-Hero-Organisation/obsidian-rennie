import { App, TFile, TFolder, Notice, Modal } from "obsidian";
import { RennieAction, RennieSettings } from "./types";

// Actions that require user confirmation before executing
const DESTRUCTIVE_ACTIONS = ["deleteFile", "updateFile", "renameFile"];

class ConfirmActionModal extends Modal {
  private result: boolean = false;
  private resolvePromise: (value: boolean) => void;

  constructor(
    app: App,
    private action: RennieAction,
    private description: string
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    
    contentEl.createEl("h2", { text: "Confirm Action" });
    contentEl.createEl("p", { text: "Rennie wants to perform the following action:" });
    
    const detailsEl = contentEl.createDiv({ cls: "rennie-confirm-details" });
    detailsEl.createEl("strong", { text: this.getActionLabel() });
    detailsEl.createEl("p", { text: this.description });
    
    // Warning for destructive actions
    if (this.action.action === "deleteFile") {
      const warningEl = contentEl.createDiv({ cls: "rennie-confirm-warning" });
      warningEl.setText("⚠️ This action cannot be undone.");
    }

    const buttonContainer = contentEl.createDiv({ cls: "rennie-confirm-buttons" });
    
    const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => {
      this.result = false;
      this.close();
    });

    const confirmBtn = buttonContainer.createEl("button", { 
      text: "Confirm",
      cls: "mod-cta"
    });
    confirmBtn.addEventListener("click", () => {
      this.result = true;
      this.close();
    });

    // Focus confirm button
    confirmBtn.focus();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    if (this.resolvePromise) {
      this.resolvePromise(this.result);
    }
  }

  private getActionLabel(): string {
    switch (this.action.action) {
      case "deleteFile": return "🗑️ Delete File";
      case "updateFile": return "✏️ Update File";
      case "renameFile": return "📝 Rename File";
      default: return this.action.action;
    }
  }

  async waitForResult(): Promise<boolean> {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.open();
    });
  }
}

export class ActionExecutor {
  constructor(
    private app: App,
    private getSettings: () => RennieSettings
  ) {}

  async execute(actions: RennieAction[]): Promise<{ success: number; failed: number; skipped: number }> {
    let success = 0;
    let failed = 0;
    let skipped = 0;

    for (const action of actions) {
      try {
        // Check if action requires confirmation
        if (DESTRUCTIVE_ACTIONS.includes(action.action)) {
          const description = this.getActionDescription(action);
          const modal = new ConfirmActionModal(this.app, action, description);
          const confirmed = await modal.waitForResult();
          
          if (!confirmed) {
            skipped++;
            await this.logAction(action, "skipped");
            new Notice(`Rennie: Skipped ${action.action}`);
            continue;
          }
        }

        await this.executeOne(action);
        await this.logAction(action, "success");
        success++;
      } catch (err) {
        console.error("Action failed:", action, err);
        await this.logAction(action, "failed", err instanceof Error ? err.message : String(err));
        failed++;
      }
    }

    if (success > 0) {
      new Notice(`Rennie: ${success} action(s) completed`);
    }
    if (failed > 0) {
      new Notice(`Rennie: ${failed} action(s) failed`);
    }

    return { success, failed, skipped };
  }

  private async logAction(
    action: RennieAction,
    status: "success" | "failed" | "skipped",
    error?: string
  ): Promise<void> {
    const settings = this.getSettings();
    if (!settings.auditLogEnabled) return;

    const { vault } = this.app;
    const logPath = settings.auditLogPath;
    const timestamp = new Date().toISOString();
    
    // Format the log entry
    const statusEmoji = status === "success" ? "✅" : status === "failed" ? "❌" : "⏭️";
    let entry = `\n| ${timestamp} | ${statusEmoji} ${status} | \`${action.action}\` | `;
    
    switch (action.action) {
      case "createFile":
      case "deleteFile":
      case "openFile":
        entry += `\`${action.path}\` |`;
        break;
      case "updateFile":
      case "appendToFile":
        entry += `\`${action.path}\` |`;
        break;
      case "renameFile":
        entry += `\`${action.path}\` → \`${action.newPath}\` |`;
        break;
      default:
        entry += `${JSON.stringify(action)} |`;
    }

    if (error) {
      entry += ` ${error}`;
    }

    // Get or create the log file
    let logFile = vault.getAbstractFileByPath(logPath);
    
    if (!logFile) {
      // Create parent folders if needed
      const folderPath = logPath.substring(0, logPath.lastIndexOf("/"));
      if (folderPath) {
        const folder = vault.getAbstractFileByPath(folderPath);
        if (!folder) {
          await vault.createFolder(folderPath);
        }
      }
      
      // Create the log file with header
      const header = `# Rennie Audit Log

| Timestamp | Status | Action | Details |
|-----------|--------|--------|---------|`;
      await vault.create(logPath, header + entry);
    } else if (logFile instanceof TFile) {
      // Append to existing log
      const content = await vault.read(logFile);
      await vault.modify(logFile, content + entry);
    }
  }

  private getActionDescription(action: RennieAction): string {
    switch (action.action) {
      case "deleteFile":
        return `Delete: ${action.path}`;
      case "updateFile":
        return `Replace contents of: ${action.path}`;
      case "renameFile":
        return `Rename: ${action.path} → ${action.newPath}`;
      default:
        return JSON.stringify(action);
    }
  }

  private async executeOne(action: RennieAction): Promise<void> {
    const { vault } = this.app;

    switch (action.action) {
      case "createFile": {
        const exists = vault.getAbstractFileByPath(action.path);
        if (exists) {
          throw new Error(`File already exists: ${action.path}`);
        }
        // Create parent folders if needed
        const folderPath = action.path.substring(0, action.path.lastIndexOf("/"));
        if (folderPath) {
          const folder = vault.getAbstractFileByPath(folderPath);
          if (!folder) {
            await vault.createFolder(folderPath);
          }
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
        throw new Error(`Unknown action: ${(action as RennieAction).action}`);
    }
  }
}
