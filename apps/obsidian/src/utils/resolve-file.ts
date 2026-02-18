import type { App, TFile } from 'obsidian'

/**
 * 多级回退解析文件路径，兼容 Obsidian 附件文件夹配置
 *
 * 解析顺序：
 * 1. metadataCache 链接解析（标准 wiki-link 解析）
 * 2. vault 精确路径查找
 * 3. 附件文件夹下查找（支持固定路径和 ./ 相对路径）
 */
export function resolveFile(app: App, nameOrPath: string, sourceFile: TFile): TFile | null {
  if (!nameOrPath)
    return null

  // 第 1 级：标准链接解析
  const linked = app.metadataCache.getFirstLinkpathDest(nameOrPath, sourceFile.path)
  if (linked)
    return linked

  // 第 2 级：按精确 vault 路径查找
  const byPath = app.vault.getFileByPath(nameOrPath)
  if (byPath)
    return byPath

  // 第 3 级：在附件文件夹下查找
  const attachmentFolder = (app.vault as any).config?.attachmentFolderPath as string | undefined
  if (attachmentFolder) {
    let folderPath: string

    if (attachmentFolder.startsWith('./')) {
      // 相对于当前文件所在目录
      const sourceDir = sourceFile.path.substring(0, sourceFile.path.lastIndexOf('/'))
      const relative = attachmentFolder.slice(2) // 去掉 './'
      folderPath = sourceDir ? `${sourceDir}/${relative}` : relative
    }
    else {
      // 固定文件夹路径
      folderPath = attachmentFolder
    }

    const fullPath = folderPath ? `${folderPath}/${nameOrPath}` : nameOrPath
    const inAttachments = app.vault.getFileByPath(fullPath)
    if (inAttachments)
      return inAttachments
  }

  return null
}
