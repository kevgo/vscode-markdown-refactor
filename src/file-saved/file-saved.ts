import * as path from "path"
import * as util from "util"
import * as vscode from "vscode"

import * as tikibase from "./tikibase"

type Listener = (e: vscode.TextDocument) => void

/** provides a callback function to provide to vscode.workspace.onDidSaveTextDocument */
export function createCb(args: { debug: vscode.OutputChannel; workspacePath: string }): Listener {
  const handler = new SaveEventHandler(args)
  return handler.fileSaved.bind(handler)
}

/** collection of state and logic around handling onDidSaveTextDocument events in VSCode */
class SaveEventHandler {
  readonly collection: vscode.DiagnosticCollection
  readonly debug: vscode.OutputChannel
  readonly workspacePath: string

  a = 1
  constructor(args: { debug: vscode.OutputChannel; workspacePath: string }) {
    this.collection = vscode.languages.createDiagnosticCollection("Markdown IDE")
    this.debug = args.debug
    this.workspacePath = args.workspacePath
  }

  async fileSaved() {
    const messages = await tikibase.run({ debug: this.debug, opts: { cwd: this.workspacePath } })
    // const issues =
    this.collection.clear()
    for (const message of messages) {
      this.debug.appendLine(`MESSAGE: ${util.inspect(message)}`)
      const fullPath = path.join(this.workspacePath, message.file)
      const uri = vscode.Uri.file(fullPath)
      const diagnostic: vscode.Diagnostic = {
        range: new vscode.Range(message.line, message.start, message.line, message.end),
        message: message.text,
        severity: vscode.DiagnosticSeverity.Error
      }
      this.collection.set(uri, [diagnostic])
    }
  }
}
