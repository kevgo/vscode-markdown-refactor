import * as vscode from "vscode"

import { filesDeleted } from "./files-deleted"
import { filesRenamed } from "./files-renamed"
import { markdownLinkCompletionProvider } from "./markdown-link-completion/markdown-link-provider"
import { renameTitle } from "./rename-title"
import * as tikibase from "./tikibase"

export function activate(context: vscode.ExtensionContext): void {
  // autocomplete links by typing `[`
  const provider = vscode.languages.registerCompletionItemProvider(
    "markdown",
    markdownLinkCompletionProvider,
    "["
  )
  context.subscriptions.push(provider)

  // file renamed --> update links to this file
  vscode.workspace.onDidRenameFiles(filesRenamed)

  // file deleted --> remove links to this file
  vscode.workspace.onDidDeleteFiles(filesDeleted)

  // rename document title --> update links with the old document title
  context.subscriptions.push(vscode.commands.registerCommand("markdownIDE.renameDocumentTitle", renameTitle))

  const collection = vscode.languages.createDiagnosticCollection("test")
  if (vscode.window.activeTextEditor) {
    tikibase.updateDiagnostics(vscode.window.activeTextEditor.document, collection)
  }
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
    if (editor) {
      tikibase.updateDiagnostics(editor.document, collection)
    }
  }))
}
