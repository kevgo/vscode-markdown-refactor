import slugify from "@sindresorhus/slugify"
import { promises as fs } from "fs"
import * as path from "path"
import * as vscode from "vscode"

export class TikibaseProvider implements vscode.CodeActionProvider {
  /** name of the code action that this provider implements */
  public static readonly autofixCommandName = "vscode-markdown-ide.autofix"
  public static readonly extractTitleCommandName = "vscode-markdown-ide.extractTitle"
  public static readonly extractBodyCommandName = "vscode-markdown-ide.extractBody"
  public static readonly linkToNoteCommandName = "vscode-markdown-ide.linkToNote"

  async provideCodeActions(
    document: vscode.TextDocument,
    range: vscode.Range | vscode.Selection,
    context: vscode.CodeActionContext
  ): Promise<vscode.CodeAction[]> {
    const result: vscode.CodeAction[] = []

    // "extract note" refactor
    if (!range.isEmpty) {
      if (range.isSingleLine) {
        const text = document.getText(range)
        const fileName = mdFileName(text)
        const filePath = path.join(path.dirname(document.fileName), fileName)
        let fileExists: boolean
        try {
          const stats = await fs.stat(filePath)
          fileExists = stats.isFile()
        } catch (e) {
          fileExists = false
        }
        if (fileExists) {
          // "link to note" refactor
          const linkToFileAction = new vscode.CodeAction(
            `link to ${fileName}`,
            vscode.CodeActionKind.RefactorRewrite
          )
          linkToFileAction.command = {
            command: TikibaseProvider.linkToNoteCommandName,
            title: "replace the selection with a link to the selected file"
          }
          result.push(linkToFileAction)
        } else {
          // "extract title" refactor
          const extractTitleAction = new vscode.CodeAction(
            `create ${fileName}`,
            vscode.CodeActionKind.RefactorExtract
          )
          extractTitleAction.command = {
            command: TikibaseProvider.extractTitleCommandName,
            title: `create a new note with the filename "${fileName}"`
          }
          result.push(extractTitleAction)
        }
      } else {
        // "extract body" refactor
        const extractBodyAction = new vscode.CodeAction(
          "extract note with this content",
          vscode.CodeActionKind.RefactorExtract
        )
        extractBodyAction.command = {
          command: TikibaseProvider.extractBodyCommandName,
          title: "create a new note with the selected text as content"
        }
        result.push(extractBodyAction)
      }
    }

    // provide autofixes for the fixable issues
    for (const diagnostic of context.diagnostics) {
      if (diagnostic.code !== "tikibase.fixable") {
        continue
      }
      const action = new vscode.CodeAction("tikibase fix", vscode.CodeActionKind.QuickFix)
      action.command = {
        command: TikibaseProvider.autofixCommandName,
        title: "let Tikibase fix this and all other problems"
      }
      action.diagnostics = [diagnostic]
      action.isPreferred = true
      result.push(action)
    }

    return result
  }
}

export async function extractNoteTitle(): Promise<void> {
  const editor = vscode.window.activeTextEditor
  if (!editor) {
    return
  }
  const range = editor.selection
  const selectedText = editor.document.getText(range)
  const newFileName = mdFileName(selectedText)
  const newFileUri = vscode.Uri.file(path.join(path.dirname(editor.document.fileName), newFileName))
  const edit = new vscode.WorkspaceEdit()
  edit.replace(editor.document.uri, range, `[${selectedText}](${newFileName})`)
  edit.createFile(newFileUri, { overwrite: false })
  edit.insert(newFileUri, new vscode.Position(0, 0), `# ${selectedText}\n`)
  await vscode.workspace.applyEdit(edit)
}

export async function extractNoteBody(): Promise<void> {
  const editor = vscode.window.activeTextEditor
  if (!editor) {
    return
  }
  const range = editor.selection
  const newTitle = await enterTitle()
  if (!newTitle) {
    return
  }
  const selectedText = editor.document.getText(range)
  const newFileName = mdFileName(newTitle)
  const newFileUri = vscode.Uri.file(path.join(path.dirname(editor.document.fileName), newFileName))
  const edit = new vscode.WorkspaceEdit()
  edit.replace(editor.document.uri, range, `[${newTitle}](${newFileName})`)
  edit.createFile(newFileUri, { overwrite: false })
  edit.insert(newFileUri, new vscode.Position(0, 0), `# ${newTitle}\n\n${selectedText}\n`)
  await vscode.workspace.applyEdit(edit)
}

export async function linkToNote(): Promise<void> {
  const editor = vscode.window.activeTextEditor
  if (!editor) {
    return
  }
  const range = editor.selection
  const selectedText = editor.document.getText(range)
  const fileName = mdFileName(selectedText)
  const edit = new vscode.WorkspaceEdit()
  edit.replace(editor.document.uri, range, `[${selectedText}](${fileName})`)
  await vscode.workspace.applyEdit(edit)
}

/** provides the filename for a note with the given title */
export function mdFileName(title: string): string {
  let result = `${slugify(title)}`
  if (!result.endsWith(".md")) {
    result = result + ".md"
  }
  return result
}

async function enterTitle(): Promise<string | undefined> {
  return vscode.window.showInputBox({
    title: "new document title"
  })
}
