import * as path from "path"
import * as vscode from "vscode"

import * as configuration from "./configuration"
import * as files from "./helpers/files"
import * as line from "./helpers/line"
import * as links from "./helpers/links"

export function createCallback(tikibaseEnabled: boolean, runTikibase: () => Promise<void>) {
  return filesRenamed.bind(null, tikibaseEnabled, runTikibase)
}

async function filesRenamed(
  tikibaseEnabled: boolean,
  runTikibase: () => Promise<void>,
  renamedEvent: vscode.FileRenameEvent
): Promise<void> {
  // flush all open changes to the filesystem since we are about to read from it
  await vscode.workspace.saveAll(false)
  await updateLinks(renamedEvent)
  if (tikibaseEnabled) {
    await runTikibase()
  }
}

async function updateLinks(renamedEvent: vscode.FileRenameEvent) {
  const wsRoot = configuration.workspacePath()
  if (!wsRoot) {
    return
  }
  const progressOpts: vscode.ProgressOptions = {
    location: vscode.ProgressLocation.Window,
    title: "updating link targets",
    cancellable: false
  }
  await vscode.window.withProgress(progressOpts, async () => {
    const edit = new vscode.WorkspaceEdit()
    const mdFiles: files.FileResult[] = []
    await files.markdown(wsRoot, mdFiles)
    for (const mdFile of mdFiles) {
      const oldContent = await mdFile.content
      let newContent = oldContent
      const fullPath = path.join(wsRoot, mdFile.filePath)
      const fullDir = path.dirname(fullPath)
      for (const renamedFile of renamedEvent.files) {
        newContent = links.replaceTarget({
          text: newContent,
          oldTarget: path.relative(fullDir, renamedFile.oldUri.fsPath),
          newTarget: path.relative(fullDir, renamedFile.newUri.fsPath)
        })
      }
      if (newContent === oldContent) {
        continue
      }
      const range = new vscode.Range(0, 0, line.count(oldContent), 0)
      edit.replace(vscode.Uri.file(fullPath), range, newContent)
    }
    await vscode.workspace.applyEdit(edit)
  })
}
