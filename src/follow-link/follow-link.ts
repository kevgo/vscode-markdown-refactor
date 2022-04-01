import * as path from "path"
import * as vscode from "vscode"

export async function followLink(debug: vscode.OutputChannel): Promise<void> {
  const oldDocument = vscode.window.activeTextEditor?.document
  if (!oldDocument) {
    return
  }
  const oldFilePath = oldDocument.fileName
  const oldCursor = vscode.window.activeTextEditor?.selection.start
  if (!oldCursor) {
    return
  }
  const cursorLine = oldDocument.lineAt(oldCursor.line)
  const linkTarget = extractLinkTarget(cursorLine.text, oldCursor.character)
  if (!linkTarget) {
    return
  }
  if (isWebLink(linkTarget)) {
    await openWebLink(linkTarget)
    return
  }
  const oldFileName = path.basename(oldFilePath)
  const newPath = path.resolve(path.dirname(oldFilePath), linkTarget)
  const newFileContent = await openFileLink(newPath)
  if (!newFileContent) {
    return
  }
  const newCursor = locatePhraseInText({ phrase: oldFileName, text: newFileContent })
  if (!newCursor) {
    return
  }
  const editor = vscode.window.activeTextEditor
  if (!editor) {
    return
  }
  editor.selection = new vscode.Selection(newCursor.start, newCursor.end)
  vscode.window.activeTextEditor?.revealRange(editor.selection)
}

/** provides the range where the given phrase occurs in the given text */
export function locatePhraseInText(
  args: { phrase: string; text: string }
): vscode.Range | undefined {
  for (const [i, line] of args.text.split(/\r?\n/).entries()) {
    const pos = line.indexOf(args.phrase)
    if (pos > -1) {
      return new vscode.Range(i, pos, i, pos + args.phrase.length)
    }
  }
}

/** opens the given link in the default web browser */
async function openWebLink(link: string) {
  await vscode.env.openExternal(vscode.Uri.parse(link))
}

/** opens a new tab with the given document */
async function openFileLink(link: string): Promise<string | null> {
  const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(link))
  await vscode.window.showTextDocument(doc)
  return doc.getText()
}

/** provides the target of the Markdown link around the given cursor position in the given text */
export function extractLinkTarget(lineText: string, cursorColumn: number): string | undefined {
  // go left until we find `(`
  let start = cursorColumn
  while (start >= 0 && lineText[start] !== "(") {
    start--
  }
  // if we didn't find it, go right until we find `(`
  if (start === -1) {
    start = cursorColumn
    while (start <= lineText.length && lineText[start] !== "(") {
      start++
    }
  }
  if (start === lineText.length + 1) {
    // start token not found in entire string
    return undefined
  }
  // go right until we find `)`
  let end = start
  while (end <= lineText.length && lineText[end] !== ")") {
    end++
  }
  if (end === lineText.length + 1) {
    // end token not found in entire string
    return undefined
  }
  return lineText.substring(start + 1, end)
}

/** indicates whether the given */
export function isWebLink(text: string): boolean {
  return text.startsWith("https://") || text.startsWith("http://")
}
