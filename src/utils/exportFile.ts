import type { ExportResult } from '@/types/api'

interface FileCallbacks {
  success: () => void
  fail: (error: unknown) => void
}

const nativeErrorDetail = (error: unknown): string => {
  if (!error || typeof error !== 'object') return typeof error === 'string' ? error : ''
  const detail = error as { errMsg?: unknown; message?: unknown; errno?: unknown; errCode?: unknown }
  const message = typeof detail.errMsg === 'string' ? detail.errMsg : typeof detail.message === 'string' ? detail.message : ''
  const code = detail.errno ?? detail.errCode
  return [message, typeof code === 'number' || typeof code === 'string' ? `错误码 ${code}` : ''].filter(Boolean).join('；')
}

const exportError = (message: string, error: unknown): Error => {
  const detail = nativeErrorDetail(error)
  return new Error(`${message}：${detail || '微信未返回具体原因，请重试'}`)
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
    const fail = (error: unknown) => reject(exportError('文件写入失败', error))
    try {
      api.getFileSystemManager!().writeFile({ filePath, data: result.content, encoding: 'utf8', success: () => resolve(), fail })
    } catch (error) { fail(error) }
  })

  return new Promise<ExportFileOutcome>((resolve, reject) => {
    const fail: FileCallbacks['fail'] = (error) => {
      if (/\b(cancel|canceled|cancelled)\b/i.test(nativeErrorDetail(error))) { resolve('cancelled'); return }
      reject(exportError(saveToDisk ? '文件保存失败' : '文件分享失败', error))
    }
    try {
      // saveFileToDisk 仅支持 PC；CSV/JSON 不能使用 openDocument 预览。
      if (saveToDisk) api.saveFileToDisk!({ filePath, success: () => resolve('saved'), fail })
      else api.shareFileMessage!({ filePath, fileName: result.file_name, success: () => resolve('shared'), fail })
    } catch (error) { fail(error) }
  })
}
