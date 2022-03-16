import * as vscode from "vscode"

import { Configuration } from "./configuration"
import * as fileSaved from "./file-saved"
import { filesDeleted } from "./files-deleted"
import { filesRenamed } from "./files-renamed"
import { markdownLinkCompletionProvider } from "./markdown-link-completion/markdown-link-provider"
import { renameTitle } from "./rename-title"

export function activate(context: vscode.ExtensionContext): void {
  const config = new Configuration()
  const workspacePath = config.workspacePath()
  if (!workspacePath) {
    return
  }
  const debug = vscode.window.createOutputChannel("Markdown IDE")

  // autocomplete links by typing `[`
  const provider = vscode.languages.registerCompletionItemProvider(
    "markdown",
    markdownLinkCompletionProvider(debug),
    "["
  )
  context.subscriptions.push(provider)

  // file renamed --> update links to this file
  vscode.workspace.onDidRenameFiles(filesRenamed)

  // file deleted --> remove links to this file
  vscode.workspace.onDidDeleteFiles(filesDeleted)

  // save file --> run Tikibase linter
  vscode.workspace.onDidSaveTextDocument(fileSaved.createCb({ debug, workspacePath }))

  // rename document title --> update links with the old document title
  context.subscriptions.push(vscode.commands.registerCommand("markdownIDE.renameDocumentTitle", renameTitle))

  // if (vscode.window.activeTextEditor) {
  //   tikibase.updateDiagnostics(vscode.window.activeTextEditor.document, collection)
  // }
  // context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
  //   if (editor) {
  //     tikibase.updateDiagnostics(editor.document, collection)
  //   }
  // }))
}
