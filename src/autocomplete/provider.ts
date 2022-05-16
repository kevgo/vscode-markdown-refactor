import { promises as fs } from "fs"
import * as path from "path"
import * as vscode from "vscode"

import * as configuration from "../configuration"
import * as files from "../helpers/files"
import * as headings from "../helpers/headings"
import * as links from "../helpers/links"

export function createCompletionProvider(
  debug: vscode.OutputChannel,
  workspacePath: string,
  tikiConfig: configuration.Tikibase | undefined
): vscode.CompletionItemProvider {
  return {
    async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
      const startTime = new Date().getTime()
      if (position.line === 0) {
        return
      }
      const documentDir = path.dirname(document.fileName)
      switch (determineType(document.lineAt(position).text, position.character)) {
        case AutocompleteType.MD_LINK:
          return mdCompletionItems({
            debug,
            documentDir,
            startTime,
            titleRE: tikiConfig?.titleRegex(),
            wsRoot: workspacePath
          })
        case AutocompleteType.IMG:
          return imgCompletionItems({ debug, documentDir, startTime, wsRoot: workspacePath })
        case AutocompleteType.HEADING:
          return headingCompletionItems({
            debug,
            documentDir,
            startTime,
            wsRoot: workspacePath
          })
      }
    }
  }
}

/** describes what type of auto-completion is needed */
export enum AutocompleteType {
  /** autocomplete a markdown link */
  MD_LINK,
  /** autocomplete an image tag */
  IMG,
  /** autocomplete a markdown heading */
  HEADING,
  /** no autocompletion item found */
  NONE
}

/** determines which autocompletion is needed */
export function determineType(line: string, pos: number): AutocompleteType {
  let i
  for (i = pos - 1; i > 0; i--) {
    if (line[i] === "[") {
      break
    }
  }
  if (i === 0) {
    if (line[0] === "[") {
      return AutocompleteType.MD_LINK
    }
    if (line[0] === "#") {
      return AutocompleteType.HEADING
    }
    return AutocompleteType.NONE
  }
  if (line[i - 1] === "!") {
    return AutocompleteType.IMG
  }
  return AutocompleteType.MD_LINK
}

async function headingCompletionItems(
  args: {
    debug: vscode.OutputChannel
    documentDir: string
    startTime: number
    wsRoot: string
  }
): Promise<vscode.CompletionItem[]> {
  const configuredSections = await loadConfiguredSections(args.documentDir)
  if (configuredSections) {
    return completionItems(removeFirstChars(configuredSections))
  }
  return completionItems(
    await headingsInFiles({
      debug: args.debug,
      startTime: args.startTime,
      wsRoot: args.wsRoot
    })
  )
}

/** provides the names of all headings in all Markdown files */
async function headingsInFiles(args: {
  debug: vscode.OutputChannel
  startTime: number
  wsRoot: string
}): Promise<string[]> {
  const mdFilesAcc: files.FileResult[] = []
  await files.markdown(args.wsRoot, mdFilesAcc)
  args.debug.appendLine(
    `${new Date().getTime() - args.startTime}ms:  created all file load promises: ${mdFilesAcc.length}`
  )
  const headingsAcc: Set<string> = new Set()
  for (const mdFile of mdFilesAcc) {
    headings.inFile(await mdFile.content, headingsAcc)
  }
  args.debug.appendLine(`${new Date().getTime() - args.startTime}ms  loaded and parsed headings`)
  const result: string[] = []
  for (const heading of headingsAcc) {
    result.push(heading.substring(1))
  }
  return result
}

/** provides CompletionItems with the given contents */
function completionItems(configuredSections: string[]): vscode.CompletionItem[] {
  const result: vscode.CompletionItem[] = []
  for (const section of configuredSections) {
    result.push(
      new vscode.CompletionItem(section, vscode.CompletionItemKind.Text)
    )
  }
  return result
}

/** provides the Completion items for Markdown links */
async function mdCompletionItems(args: {
  debug: vscode.OutputChannel
  documentDir: string
  startTime: number
  titleRE: RegExp | undefined
  wsRoot: string
}): Promise<vscode.CompletionItem[]> {
  const mdFilesAcc: files.FileResult[] = []
  await files.markdown(args.wsRoot, mdFilesAcc)
  const result = []
  for (const mdFile of mdFilesAcc) {
    const filePath = args.documentDir !== args.wsRoot
      ? path.relative(args.documentDir, path.join(args.wsRoot, mdFile.filePath))
      : mdFile.filePath
    const link = links.markdown({
      filePath,
      fileContent: await mdFile.content,
      debug: args.debug,
      titleRE: args.titleRE
    })
    result.push(
      new vscode.CompletionItem(
        link.substring(1),
        vscode.CompletionItemKind.Text
      )
    )
  }
  args.debug.appendLine(`${new Date().getTime() - args.startTime}ms:  ${result.length} links created`)
  return result
}

/** provides the CompletionItems for image links */
async function imgCompletionItems(args: {
  debug: vscode.OutputChannel
  documentDir: string
  startTime: number
  wsRoot: string
}): Promise<vscode.CompletionItem[]> {
  const filenamesAcc: string[] = []
  await files.images(args.wsRoot, filenamesAcc)
  const result: vscode.CompletionItem[] = []
  for (const filename of filenamesAcc) {
    const filePath = args.documentDir !== args.wsRoot
      ? path.relative(args.documentDir, path.join(args.wsRoot, filename))
      : filename
    result.push(
      new vscode.CompletionItem(
        links.image(filePath).substring(1),
        vscode.CompletionItemKind.Text
      )
    )
  }
  args.debug.appendLine(`${new Date().getTime() - args.startTime}ms:  ${result.length} links created`)
  return result
}

async function loadConfiguredSections(documentDir: string): Promise<string[] | undefined> {
  for (const dir in parentDirs(documentDir)) {
    const configPath = path.join(dir, "tikibase.json")
    try {
      const content = await fs.readFile(configPath, "utf-8")
      const config: configuration.TikibaseConfig = JSON.parse(content)
      if (config.sections) {
        return config.sections
      }
    } catch (e) {
      // cannot read file --> stop looking for more config files
      return
    }
  }
}

export function* parentDirs(dir: string): Generator<string> {
  yield dir
  const elements = dir.split(path.sep)
  while (elements.length > 2) {
    elements.pop()
    yield elements.join(path.sep)
  }
}

export function removeFirstChars(strings: string[]): string[] {
  return strings.map((element) => element.substring(1))
}
