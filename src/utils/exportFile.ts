import type { ExportResult } from '@/types/api'

interface FileCallbacks {
  success: () => void
  fail: (error: { errMsg?: string }) => void
}

export interface WeChatExportApi {
  env?: { USER_DATA_PATH?: string }
  getFileSystemManager?: () => { writeFile: (options: FileCallbacks & { filePath: string; data: string; encoding: 'utf8' }) => void }
  saveFileToDisk?: (options: FileCallbacks & { filePath: string }) => void
  shareFileMessage?: (options: FileCallbacks & { filePath: string; fileName: string }) => void
}

export type ExportFileOutcome = 'saved' | 'shared' | 'cancelled' | 'downloaded'

export const saveWeChatExport = async (api: WeChatExportApi | undefined, platform: string, result: ExportResult): Promise<ExportFileOutcome> => {
  const root = api?.env?.USER_DATA_PATH
  if (!api?.getFileSystemManager || !root) throw new Error('暂时无法准备文件，请重新打开小程序后重试')
  const desktop = platform === 'windows' || platform === 'mac'
  const saveToDisk = desktop && typeof api.saveFileToDisk === 'function'
  if (!saveToDisk && !api.shareFileMessage) throw new Error('当前微信不支持文件分享，请升级微信或使用电脑版导出')
  const filePath = `${root}/${result.file_name}`

  await new Promise<void>((resolve, reject) => {
    const fail = () => reject(new Error('文件写入失败，请检查可用空间后重试'))
    try {
      api.getFileSystemManager!().writeFile({ filePath, data: result.content, encoding: 'utf8', success: () => resolve(), fail })
    } catch { fail() }
  })

  return new Promise<ExportFileOutcome>((resolve, reject) => {
    const fail: FileCallbacks['fail'] = (error) => {
      if (/cancel/i.test(error?.errMsg || '')) { resolve('cancelled'); return }
      reject(new Error(saveToDisk ? '文件保存失败，请重试' : '文件分享失败，请在微信真机中重试'))
    }
    try {
      // saveFileToDisk 仅支持 PC；CSV/JSON 不能使用 openDocument 预览。
      if (saveToDisk) api.saveFileToDisk!({ filePath, success: () => resolve('saved'), fail })
      else api.shareFileMessage!({ filePath, fileName: result.file_name, success: () => resolve('shared'), fail })
    } catch { fail({}) }
  })
}
