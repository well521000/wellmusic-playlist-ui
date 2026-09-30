/**
 * 网易云音乐听歌排行 & 最近播放同步
 * 参考 kumone 实现：https://github.com/missuo/kumone
 *
 * 两个 weblog 接口配合使用：
 * 1. startplay - 写入「最近播放」列表
 * 2. play - 增加听歌排行次数和时长
 *
 * 注意：必须使用 eapi 加密，并且带桌面客户端 cookie (os=osx)
 */

import { eapiBody, buildEapiHeader } from './neteaseCrypto'
import { logInfo, logError } from '../logger'
import { useDailyRecommendStore } from '@/store/dailyRecommendStore'

// 网易云 API 基础地址
const NETEASE_BASE = 'https://music.163.com'

// 存储当前播放的歌曲信息，用于播放完成时上报
let currentTrackInfo = null

/**
 * 获取网易云 cookie（从 dailyRecommendStore 读取）
 */
function getNeteaseCookie() {
  try {
    const state = useDailyRecommendStore.getState()
    return state.cookie || ''
  } catch (e) {
    logError('获取网易云cookie失败', e)
    return ''
  }
}

/**
 * 检查是否已登录网易云
 */
export function isNeteaseLoggedIn() {
  const cookie = getNeteaseCookie()
  return cookie.includes('MUSIC_U=') || cookie.includes('MUSIC_A=') || cookie.length > 50
}

/**
 * 发送 weblog 上报
 * @param logs - 日志数组
 */
async function sendWeblog(logs) {
  try {
    const cookie = getNeteaseCookie()
    if (!cookie) {
      logInfo('网易云未登录，跳过听歌上报')
      return false
    }

    const logsString = JSON.stringify(logs)
    // eapi payload 必须带 header（对齐 Kumone），否则服务端静默忽略
    const body = eapiBody('/api/feedback/weblog', { logs: logsString, header: buildEapiHeader(cookie) })

    // eapi 接口必须走 interface.music.163.com（与 Kumone 一致），
    // 走 music.163.com 会被忽略导致听歌排行不涨
    const response = await fetch('https://interface.music.163.com/eapi/feedback/weblog', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookie + '; os=osx; ',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://music.163.com/',
      },
      body,
    })

    const data = await response.json()
    if (data.code === 200) {
      logInfo('网易云听歌上报成功', logs[0] && logs[0].action)
      return true
    } else {
      logError('网易云听歌上报失败', data)
      return false
    }
  } catch (e) {
    logError('网易云听歌上报异常', e)
    return false
  }
}

/**
 * 开始播放上报（写入最近播放列表）
 * 在歌曲开始播放时调用
 *
 * @param trackId - 歌曲 ID
 * @param sourceId - 来源歌单 ID（可选，默认 0）
 */
export async function scrobbleStart(trackId, sourceId = 0) {
  try {
    if (!isNeteaseLoggedIn()) {
      logInfo('网易云未登录，跳过startplay上报')
      return
    }

    // 记录当前播放信息
    currentTrackInfo = {
      trackId,
      sourceId,
      startTime: Date.now(),
      playedSeconds: 0,
    }

    logInfo('准备发送startplay上报', { trackId, sourceId })

    // 发送 startplay weblog
    const result = await sendWeblog([
      {
        action: 'startplay',
        json: {
          id: trackId,
          type: 'song',
          mainsite: '1',
          mainsiteWeb: '1',
          content: `id=${sourceId}`,
        },
      },
    ])

    if (result) {
      logInfo('开始播放上报成功', { trackId, sourceId })
    } else {
      logError('开始播放上报失败', { trackId, sourceId })
    }
  } catch (e) {
    logError('开始播放上报异常', e)
  }
}

/**
 * 播放完成上报（增加听歌排行次数和时长）
 * 在歌曲播放完成或切换歌曲时调用
 *
 * @param trackId - 歌曲 ID
 * @param sourceId - 来源歌单 ID
 * @param seconds - 实际播放秒数
 */
export async function scrobbleFinish(trackId, sourceId = 0, seconds) {
  try {
    if (!isNeteaseLoggedIn()) {
      logInfo('网易云未登录，跳过play上报')
      return
    }

    // 计算实际播放时长
    let playSeconds = seconds
    if (playSeconds === undefined && currentTrackInfo && currentTrackInfo.trackId === trackId) {
      playSeconds = Math.floor((Date.now() - currentTrackInfo.startTime) / 1000)
    }
    if (playSeconds === undefined || playSeconds < 0) {
      playSeconds = 0
    }

    logInfo('准备发送play上报', { trackId, sourceId, seconds: playSeconds })

    // 发送 play weblog
    const result = await sendWeblog([
      {
        action: 'play',
        json: {
          download: 0,
          end: 'playend',
          id: trackId,
          sourceId: String(sourceId),
          time: playSeconds,
          type: 'song',
          wifi: 0,
          source: 'list',
          mainsite: '1',
          mainsiteWeb: '1',
          content: `id=${sourceId}`,
        },
      },
    ])

    if (result) {
      logInfo('播放完成上报成功', { trackId, sourceId, seconds: playSeconds })
    } else {
      logError('播放完成上报失败', { trackId, sourceId, seconds: playSeconds })
    }

    // 清除当前播放信息
    if (currentTrackInfo && currentTrackInfo.trackId === trackId) {
      currentTrackInfo = null
    }
  } catch (e) {
    logError('播放完成上报异常', e)
  }
}

/**
 * 切换歌曲时调用：先完成上一首的上报，再开始下一首的上报
 *
 * @param newTrackId - 新歌曲 ID
 * @param newSourceId - 新来源歌单 ID
 * @param oldTrackId - 上一首歌曲 ID（可选）
 * @param oldSourceId - 上一首来源歌单 ID（可选）
 */
export async function scrobbleSwitch(newTrackId, newSourceId = 0, oldTrackId, oldSourceId = 0) {
  try {
    // 先完成上一首的上报
    if (oldTrackId !== undefined) {
      await scrobbleFinish(oldTrackId, oldSourceId)
    } else if (currentTrackInfo) {
      await scrobbleFinish(currentTrackInfo.trackId, currentTrackInfo.sourceId)
    }

    // 再开始下一首的上报
    await scrobbleStart(newTrackId, newSourceId)
  } catch (e) {
    logError('切换歌曲上报失败', e)
  }
}

/**
 * 获取听歌排行数据
 *
 * @param uid - 用户 ID
 * @param week - true=本周排行, false=所有排行
 * @returns 排行数据
 */
export async function getPlayRecords(uid, week = true) {
  try {
    const cookie = getNeteaseCookie()
    if (!cookie) return []

    const body = eapiBody('/api/v1/play/record', {
      uid,
      type: week ? 1 : 0,
      header: buildEapiHeader(cookie),
    })

    // eapi 接口必须走 interface.music.163.com
    const response = await fetch('https://interface.music.163.com/eapi/v1/play/record', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://music.163.com/',
      },
      body,
    })

    const data = await response.json()
    if (data.code === 200) {
      return week ? (data.weekData || []) : (data.allData || [])
    }
    return []
  } catch (e) {
    logError('获取听歌排行失败', e)
    return []
  }
}

export default {
  scrobbleStart,
  scrobbleFinish,
  scrobbleSwitch,
  getPlayRecords,
  isNeteaseLoggedIn,
}
