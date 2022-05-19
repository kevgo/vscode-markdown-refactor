import * as vscode from "vscode"

import { createCompletionProvider } from "./autocomplete/provider"
import { extractNoteBody, extractNoteTitle, linkToNote, TikibaseProvider } from "./code-action/tikibase-provider"
import * as configuration from "./configuration"
import * as fileSaved from "./file-saved/file-saved"
import * as filesDeleted from "./files-deleted"
import * as filesRenamed from "./files-renamed"
import { MarkdownDefinitionProvider } from "./follow-link/follow-bidi-link"
import { renameTitle } from "./rename-title/rename-title"
import * as tikibase from "./tikibase"

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const workspacePath = configuration.workspacePath()
  if (!workspacePath) {
    return
  }
  const debug = vscode.window.createOutputChannel("Markdown IDE")
  const tikiConfig = await configuration.tikibase(workspacePath)
  const runTikibaseCheck = fileSaved.createCallback({ debug, workspacePath })

  // autocomplete links by typing `[`
  const completionProvider = createCompletionProvider(debug, workspacePath, tikiConfig)
  context.subscriptions.push(vscode.languages.registerCompletionItemProvider("markdown", completionProvider, "["))

  // autocomplete headings by typing `#`
  context.subscriptions.push(vscode.languages.registerCompletionItemProvider("markdown", completionProvider, "#"))

  // file renamed --> update links to this file
  const filesRenamedCb = filesRenamed.createCallback(!!tikiConfig, runTikibaseCheck)
  vscode.workspace.onDidRenameFiles(filesRenamedCb, !!tikiConfig)

  // file deleted --> remove links to this file
  const filesDeletedCb = filesDeleted.createCallback(!!tikiConfig, runTikibaseCheck)
  vscode.workspace.onDidDeleteFiles(filesDeletedCb)

  // rename document title --> update links with the old document title
  context.subscriptions.push(vscode.commands.registerCommand("markdownIDE.renameDocumentTitle", renameTitle))

  // "go to definition" for links in Markdown documents
  vscode.languages.registerDefinitionProvider("markdown", new MarkdownDefinitionProvider(tikiConfig))

  if (tikiConfig) {
    vscode.window.setStatusBarMessage("Markdown IDE: Tikibase mode", 10000)

    // save file --> run "tikibase check"
    vscode.workspace.onDidSaveTextDocument(runTikibaseCheck)

    // "tikibase fix" command
    context.subscriptions.push(vscode.commands.registerCommand("markdownIDE.tikibaseFix", async function() {
      await tikibase.fix(workspacePath, debug)
    }))

    // "tikibase fix" code action
    context.subscriptions.push(
      vscode.languages.registerCodeActionsProvider(
        "markdown",
        new TikibaseProvider(),
        { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix, vscode.CodeActionKind.RefactorExtract] }
      )
    )
    context.subscriptions.push(
      vscode.commands.registerCommand(
        TikibaseProvider.autofixCommandName,
        async () => {
          await tikibase.fix(workspacePath, debug)
          await runTikibaseCheck()
        }
      )
    )

    // "extract title" refactor
    context.subscriptions.push(
      vscode.commands.registerCommand(
        TikibaseProvider.extractTitleCommandName,
        extractNoteTitle
      )
    )

    // "extract body" refactor
    context.subscriptions.push(
      vscode.commands.registerCommand(
        TikibaseProvider.extractBodyCommandName,
        extractNoteBody
      )
    )

    // "link to note" refactor
    context.subscriptions.push(
      vscode.commands.registerCommand(
        TikibaseProvider.linkToNoteCommandName,
        linkToNote
      )
    )

    // run "tikibase check" at startup
    void runTikibaseCheck()
  }
}
