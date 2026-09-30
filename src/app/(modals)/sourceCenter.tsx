import React, { useState, useCallback, useEffect, useMemo } from 'react'
import SFSymbol from '@/components/SFSymbol'
import SmoothSegmentedControl from '@/components/SmoothSegmentedControl'
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Switch,
  TextInput,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { BlurView } from 'expo-blur'
import { router, useLocalSearchParams } from 'expo-router'
import {
  useSourceTestStore,
  QUALITY_LEVELS,
  TEST_QUALITY_ORDER,
  PLATFORM_COLORS,
  type PlatformQualityResult,
  type KeywordsMap,
} from '@/store/sourceTestStore'
import { useThemeColors, useAppTheme } from '@/hooks/useAppTheme'
import { ThemeColors } from '@/constants/tokens'
import {
  musicApiStore,
  musicApiSelectedStore,
  nowApiState,
  enabledMusicSourcesStore,
} from '@/helpers/trackPlayerIndex'
import myTrackPlayer from '@/helpers/trackPlayerIndex'
import PersistStatus from '@/store/PersistStatus'
import { showToast } from '@/utils/utils'
import { createMusicApiFromScript, fetchScriptFromUrl } from '@/helpers/userApi/importMusicSource'
import { reloadLxMusicScript, parseLxMusicScriptInfo } from '@/helpers/userApi/lxMusicSourceAdapter'
import { checkAllSourceUpdates, extractSrcUrl } from '@/helpers/sourceUpdateChecker'
import {
  useAutoSourceSwitchStore,
  STRATEGY_LABELS,
  DEFAULT_STRATEGY_ORDER,
} from '@/store/autoSourceSwitchStore'
import * as DocumentPicker from 'expo-document-picker'
import * as RNFS from 'react-native-fs'
import AsyncStorage from '@react-native-async-storage/async-storage'

type TabType = 'manage' | 'test' | 'auto'


const KEYWORDS_STORAGE_KEY = 'wellmusic_source_test_keywords_v3'

const loadKeywords = async (): Promise<KeywordsMap> => {
  try {
    const saved = await AsyncStorage.getItem(KEYWORDS_STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return {}
}

const saveKeywords = async (keywords: KeywordsMap) => {
  try {
    await AsyncStorage.setItem(KEYWORDS_STORAGE_KEY, JSON.stringify(keywords))
  } catch {}
}

const SourceCenter = ({ onClose }: { onClose?: () => void }) => {
  const colors = useThemeColors()
  const { isDark } = useAppTheme()
  const styles = useMemo(() => createStyles(colors), [colors])
  const [activeTab, setActiveTab] = useState<TabType>('manage')
  const [builtinSourceEnabled, setBuiltinSourceEnabled] = useState(PersistStatus.get('music.builtinSourceEnabled') === 'true')
  const [builtinSourceToastEnabled, setBuiltinSourceToastEnabled] = useState(PersistStatus.get('music.builtinSourceToastEnabled') !== 'false')

  const musicApis = musicApiStore.useValue()
  const selectedApi = musicApiSelectedStore.useValue()
  const apiState = nowApiState.useValue()
  const enabledSources = enabledMusicSourcesStore.useValue()

  const {
    enabled: autoEnabled,
    maxAttempts,
    priorityRetry,
    strategyPriority,
    setEnabled: setAutoEnabled,
    setMaxAttempts,
    setPriorityRetry,
    moveStrategy,
    setStrategyPriority,
  } = useAutoSourceSwitchStore()

  const [keywords, setKeywords] = useState<KeywordsMap>({})
  const [keywordsLoaded, setKeywordsLoaded] = useState(false)
  const [testTimeout, setTestTimeout] = useState('20')
  const [showLogModal, setShowLogModal] = useState(false)
  const [logText, setLogText] = useState('')
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false)
  const [updatableMap, setUpdatableMap] = useState<Record<string, string>>({})
  const [updateAlertEnabled] = useState(true)

  // 源测试状态/逻辑在全局 store：滑出页面后台继续测，结果保留到 App 退出
  const results = useSourceTestStore(s => s.results)
  const isTesting = useSourceTestStore(s => s.isTesting)
  const testingSourceId = useSourceTestStore(s => s.testingSourceId)
  const elapsedTime = useSourceTestStore(s => s.elapsedTime)
  const ranAll = useSourceTestStore(s => s.ranAll)
  const gotoToken = useSourceTestStore(s => s.gotoToken)
  const searchParams = useLocalSearchParams<{ tab?: string }>()

  const getKeyword = (sourceId: string): string => keywords[sourceId] ?? '晴天'
  const setKeyword = (sourceId: string, value: string) =>
    setKeywords(prev => ({ ...prev, [sourceId]: value }))

  const timeoutSec = parseInt(testTimeout) || 20
  const handleStartAll = () => useSourceTestStore.getState().testAll(keywords, timeoutSec)
  const handleTestOne = (id: string) =>
    useSourceTestStore.getState().testSingleSource(id, { keyword: getKeyword(id), timeoutSec })

  useEffect(() => {
    loadKeywords().then(k => {
      setKeywords(k)
      setKeywordsLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (keywordsLoaded) saveKeywords(keywords)
  }, [keywords, keywordsLoaded])

  // 从完成弹窗「查看结果」进入时定位到源测试 Tab
  useEffect(() => {
    if (searchParams.tab === 'test') setActiveTab('test')
  }, [searchParams.tab])
  useEffect(() => {
    if (gotoToken > 0) setActiveTab('test')
  }, [gotoToken])


  const handleToggleUpdateAlert = useCallback((v: boolean) => {
    setUpdateAlertEnabled(v)
    PersistStatus.set('music.sourceUpdateAlertDisabled', v ? 'false' : 'true')
    showToast(v ? '已开启音源更新弹窗提醒' : '已永久关闭音源更新弹窗', '', 'info')
  }, [])

  // ===== 音源更新检查 =====
  const handleCheckUpdates = useCallback(async () => {
    if (isCheckingUpdates) return
    setIsCheckingUpdates(true)
    setUpdatableMap({})
    try {
      const updatable = await checkAllSourceUpdates()
      const map: Record<string, string> = {}
      updatable.forEach(u => { map[u.api.id] = u.remoteVersion })
      setUpdatableMap(map)
      if (updatable.length === 0) {
        showToast('所有音源已是最新', '', 'success')
      } else {
        showToast(`发现 ${updatable.length} 个音源可更新`, '', 'info')
      }
    } catch (e) {
      showToast('检查更新失败', '', 'error')
    } finally {
      setIsCheckingUpdates(false)
    }
  }, [isCheckingUpdates])

  const handleUpdateSource = useCallback(async (api: any) => {
    try {
      const srcUrl = api.srcUrl || extractSrcUrl(api.script || '')
      if (!srcUrl) {
        Alert.alert('提示', '该音源没有更新地址')
        return
      }
      const resp = await fetch(srcUrl)
      if (!resp.ok) throw new Error('fetch failed')
      const newScript = await resp.text()
      if (!newScript || newScript.length < 100) throw new Error('invalid script')

      // 更新音源
      const allApis = musicApiStore.getValue() || []
      const idx = allApis.findIndex((a: any) => a.id === api.id)
      if (idx === -1) return

      const updatedApi = { ...allApis[idx], script: newScript }
      // 重新解析版本
      const info = parseLxMusicScriptInfo(newScript)
      if (info.version) updatedApi.version = info.version
      if (info.name) updatedApi.name = info.name
      if (info.author) updatedApi.author = info.author

      const newList = [...allApis]
      newList[idx] = updatedApi
      musicApiStore.setValue(newList)
      PersistStatus.set('music.musicApi', newList)

      // 如果是当前选中的音源，重新加载
      if (selectedApi?.id === api.id) {
        await reloadLxMusicScript(updatedApi)
      }

      // 从可更新列表中移除
      setUpdatableMap(prev => {
        const next = { ...prev }
        delete next[api.id]
        return next
      })

      showToast(`${api.name} 更新成功`, '', 'success')
    } catch (e: any) {
      Alert.alert('更新失败', e.message || '未知错误')
    }
  }, [selectedApi])

  // ===== 音源管理 =====
  const handleSelectSource = (sourceId: string) => {
    myTrackPlayer.setMusicApiAsSelectedById(sourceId)
    // 切换时自动启用
    const enabled = enabledMusicSourcesStore.getValue() || []
    if (!enabled.includes(sourceId)) {
      const next = [...enabled, sourceId]
      enabledMusicSourcesStore.setValue(next)
      PersistStatus.set('music.enabledMusicSources', next)
    }
    showToast('已切换音源', '', 'success')
  }

  const handleDeleteSource = (sourceId: string, name: string) => {
    Alert.alert('删除音源', `确定删除音源 "${name}" 吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          myTrackPlayer.deleteMusicApiById(sourceId)
          // 从启用列表移除
          const enabled = enabledMusicSourcesStore.getValue() || []
          const next = enabled.filter((id: string) => id !== sourceId)
          enabledMusicSourcesStore.setValue(next)
          PersistStatus.set('music.enabledMusicSources', next)
          showToast('音源已删除', '', 'success')
        },
      },
    ])
  }

  const importFromUrl = () => {
    Alert.prompt(
      '导入音源',
      '请输入音源 URL',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: async (url?: string) => {
            if (!url) { showToast('导入失败', 'URL 不能为空', 'error'); return }
            try {
              const sourceCode = await fetchScriptFromUrl(url)
              const musicApi = await createMusicApiFromScript(sourceCode)
              myTrackPlayer.addMusicApi(musicApi)
              // 导入后不自动启用，不自动选中（除非是第一个）
              showToast('音源导入成功', `「${musicApi.name}」已导入（默认未启用）`, 'success')
            } catch (error: any) {
              showToast('导入失败', error?.message || '无法导入', 'error')
            }
          },
        },
      ],
      'plain-text',
    )
  }

  const importFromFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'text/javascript', copyToCacheDirectory: false })
      if (result.canceled === true) return
      const fileUri = decodeURIComponent(result.assets[0].uri)
      const fileContents = await RNFS.readFile(fileUri, 'utf8')
      const musicApi = await createMusicApiFromScript(fileContents)
      myTrackPlayer.addMusicApi(musicApi)
      showToast('音源导入成功', `「${musicApi.name}」已导入（默认未启用）`, 'success')
    } catch (err: any) {
      showToast('导入失败', err?.message || '无法导入', 'error')
    }
  }

  // ===== 源测试（逻辑在全局 store，后台运行） =====
  const handleStop = () => useSourceTestStore.getState().stop()
  const openLogModal = () => {
    setLogText(useSourceTestStore.getState().logLines.join('\n') || '暂无日志')
    setShowLogModal(true)
  }
  const clearResults = () => useSourceTestStore.getState().clearResults()

  const moveUp = (index: number) => { if (index > 0) moveStrategy(index, index - 1) }
  const moveDown = (index: number) => { if (index < strategyPriority.length - 1) moveStrategy(index, index + 1) }

  const tabs: { key: TabType; label: string }[] = [
    { key: 'manage', label: '音源管理' },
    { key: 'test', label: '源测试' },
    { key: 'auto', label: '自动换源' },
  ]

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>音源管理</Text>
        </View>

        <View style={{ marginHorizontal: 16, marginBottom: 14 }}>
          <SmoothSegmentedControl
            options={tabs}
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as TabType)}
          />
        </View>

        {/* ===== 音源管理 ===== */}
        {activeTab === 'manage' && (
          <>
            <ScrollView style={styles.sourceList} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 170 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 4 }}>
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>我的音源 ({musicApis?.length || 0})</Text>
                <TouchableOpacity onPress={handleCheckUpdates} disabled={isCheckingUpdates} style={{ flexDirection: 'row', alignItems: 'center', padding: 6 }}>
                  {isCheckingUpdates ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <SFSymbol systemName="arrow.clockwise" size={16} color={colors.primary} />
                  )}
                  <Text style={{ color: colors.primary, fontSize: 13, marginLeft: 4 }}>检查更新</Text>
                </TouchableOpacity>
              </View>

              {(musicApis || []).map((api: any) => {
                const isSelected = selectedApi?.id === api.id
                return (
                  <TouchableOpacity
                    key={api.id}
                    style={[
                      styles.sourceRow,
                      { backgroundColor: isSelected ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : colors.card },
                    ]}
                    onPress={() => handleSelectSource(api.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.sourceRowInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.sourceRowName, { color: colors.text }]} numberOfLines={1}>
                          {api.name}
                        </Text>
                      </View>
                      <Text style={[styles.sourceRowMeta, { color: colors.textMuted }]} numberOfLines={1}>
                        {api.author || '未知作者'}{api.version ? ` · v${api.version}` : ''}
                        {isSelected ? ' · 使用中' : ''}
                        {updatableMap[api.id] ? <Text style={{ color: '#ff9500', fontWeight: '500' }}> · 可更新v{updatableMap[api.id]}</Text> : null}
                      </Text>
                    </View>
                    {updatableMap[api.id] && (
                      <TouchableOpacity
                        style={[styles.deleteBtn, { marginRight: 8 }]}
                        onPress={() => handleUpdateSource(api)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <SFSymbol systemName="cloud.and.arrow.down" size={20} color="#30d158" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteSource(api.id, api.name)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <SFSymbol systemName="trash" size={20} color="#ff453a" />
                    </TouchableOpacity>
                  </TouchableOpacity>
                )
              })}

              {(!musicApis || musicApis.length === 0) && (
                <View style={styles.emptyContainer}>
                  <SFSymbol systemName="cloud" size={48} color={colors.textMuted} />
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>暂无音源，请导入音源脚本</Text>
                </View>
              )}
            </ScrollView>

            <View style={styles.bottomBar}>
              <BlurView intensity={60} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
              <View style={styles.bottomContent}>
                <TouchableOpacity style={[styles.importBtn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]} onPress={importFromUrl} activeOpacity={0.7}>
                  <SFSymbol systemName="link" size={18} color={colors.primary} />
                  <Text style={[styles.importBtnText, { color: colors.primary }]}>URL导入</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.importBtn, { backgroundColor: colors.primary }]} onPress={importFromFile} activeOpacity={0.7}>
                  <SFSymbol systemName="doc.text" size={18} color="#ffffff" />
                  <Text style={styles.importBtnText}>文件导入</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}

        {/* ===== 源测试 ===== */}
        {activeTab === 'test' && (
          <ScrollView style={styles.testScroll} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <View style={[styles.testControlCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TouchableOpacity
                activeOpacity={0.85}
                disabled={!isTesting && !musicApis?.length}
                onPress={isTesting ? handleStop : handleStartAll}
                style={[styles.testMainBtn, { backgroundColor: isTesting ? '#ff453a' : colors.primary, opacity: !isTesting && !musicApis?.length ? 0.4 : 1 }]}
              >
                <Text style={styles.testMainBtnText}>{isTesting ? `终止测试 · ${elapsedTime}s` : '开始全部测试'}</Text>
              </TouchableOpacity>

              <View style={styles.testToolRow}>
                <View style={[styles.timeoutBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.testToolLabel, { color: colors.textMuted }]}>超时</Text>
                  <TextInput
                    style={[styles.timeoutInput, { color: colors.text }]}
                    placeholder="20"
                    placeholderTextColor={colors.textMuted}
                    value={testTimeout}
                    onChangeText={v => setTestTimeout(v.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    maxLength={3}
                    editable={!isTesting}
                  />
                  <Text style={[styles.testToolLabel, { color: colors.textMuted }]}>秒</Text>
                </View>
                <View style={{ flex: 1 }} />
                {results.length > 0 && (
                  <TouchableOpacity
                    onPress={clearResults}
                    style={[styles.testToolBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                  >
                    <SFSymbol systemName="trash" size={15} color={colors.textMuted} />
                    <Text style={[styles.testToolBtnText, { color: colors.textMuted }]}>清空</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={openLogModal}
                  style={[styles.testToolBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                >
                  <SFSymbol systemName="questionmark.circle" size={15} color={colors.primary} />
                  <Text style={[styles.testToolBtnText, { color: colors.primary }]}>日志</Text>
                </TouchableOpacity>
              </View>

              {results.length > 0 && ranAll && (
                <View style={[styles.tTotalBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(120,120,128,0.08)' }]}>
                  <View style={styles.tTotalItem}>
                    <Text style={[styles.tTotalNum, { color: '#34c759' }]}>{results.filter(r => r.status === 'success').length}</Text>
                    <Text style={[styles.tTotalLabel, { color: colors.textMuted }]}>可用音源</Text>
                  </View>
                  <View style={[styles.tTotalDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.tTotalItem}>
                    <Text style={[styles.tTotalNum, { color: '#ff453a' }]}>{results.filter(r => r.status === 'failed').length}</Text>
                    <Text style={[styles.tTotalLabel, { color: colors.textMuted }]}>失败</Text>
                  </View>
                  <View style={[styles.tTotalDivider, { backgroundColor: colors.border }]} />
                  <View style={styles.tTotalItem}>
                    <Text style={[styles.tTotalNum, { color: colors.primary }]}>{elapsedTime}s</Text>
                    <Text style={[styles.tTotalLabel, { color: colors.textMuted }]}>{isTesting ? '测试中' : '总计时'}</Text>
                  </View>
                </View>
              )}
            </View>

            {(musicApis || []).map((api: any) => {
              const result = results.find(r => r.sourceId === api.id)
              const isTestingThis = testingSourceId === api.id
              const kw = getKeyword(api.id)
              const qInfo = result?.maxQuality ? QUALITY_LEVELS.find(q => q.key === result.maxQuality) : null
              const status = result?.status || 'pending'
              const foundCount = result?.platformResults?.filter((p: PlatformQualityResult) => p.found).length || 0
              const platformRowBg = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(120,120,128,0.06)'
              return (
                <View
                  key={api.id}
                  style={[
                    styles.tCard,
                    {
                      backgroundColor:
                        status === 'success'
                          ? (isDark ? 'rgba(52,199,89,0.08)' : 'rgba(52,199,89,0.06)')
                          : status === 'failed'
                            ? (isDark ? 'rgba(255,69,58,0.08)' : 'rgba(255,69,58,0.06)')
                            : colors.card,
                    },
                  ]}
                >
                  <View style={styles.tCardHeader}>
                    {status === 'pending' && !isTestingThis ? (
                      <View style={styles.tStatusDot} />
                    ) : (
                      <View
                        style={[
                          styles.tStatusDot,
                          {
                            backgroundColor:
                              status === 'success'
                                ? '#34c759'
                                : status === 'failed'
                                  ? '#ff453a'
                                  : colors.primary,
                          },
                        ]}
                      >
                        {status === 'success' ? (
                          <SFSymbol systemName="checkmark" size={16} color="#ffffff" />
                        ) : status === 'failed' ? (
                          <SFSymbol systemName="xmark" size={14} color="#ffffff" />
                        ) : (
                          <ActivityIndicator size="small" color="#fff" />
                        )}
                      </View>
                    )}

                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.tCardName, { color: colors.text }]} numberOfLines={1}>{api.name}</Text>
                      {status === 'success' ? (
                        <Text style={[styles.tCardSub, { color: colors.textMuted }]} numberOfLines={1}>
                          {foundCount} 个平台可用 · {result?.testedSong}
                        </Text>
                      ) : isTestingThis ? (
                        <Text style={[styles.tCardSub, { color: colors.primary }]} numberOfLines={1}>
                          {result?.progress || '测试中…'}
                        </Text>
                      ) : status === 'failed' ? (
                        <Text style={[styles.tCardSub, { color: '#ff453a' }]} numberOfLines={1}>
                          {result?.message || '测试失败'}
                        </Text>
                      ) : (
                        <Text style={[styles.tCardSub, { color: colors.textMuted }]}>未测试</Text>
                      )}
                    </View>

                    {qInfo && (
                      <View style={[styles.tQualityBadge, { backgroundColor: qInfo.color + '22' }]}>
                        <Text style={[styles.tQualityBadgeText, { color: qInfo.color }]}>{qInfo.label}</Text>
                      </View>
                    )}

                    <TouchableOpacity
                      style={[styles.tPlayBtn, { backgroundColor: isTestingThis ? colors.textMuted + '33' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)') }]}
                      onPress={() => handleTestOne(api.id)}
                      disabled={isTestingThis || isTesting}
                      activeOpacity={0.8}
                    >
                      {isTestingThis ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <SFSymbol systemName="speedometer" size={14} color={colors.primary} />
                      )}
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.tSearchBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                    <SFSymbol systemName="magnifyingglass" size={15} color={colors.textMuted} />
                    <TextInput
                      style={[styles.tSearchInput, { color: colors.text }]}
                      placeholder="输入测试歌曲名"
                      placeholderTextColor={colors.textMuted}
                      value={kw}
                      onChangeText={v => setKeyword(api.id, v)}
                      editable={!isTesting}
                    />
                  </View>

                  {result && result.platformResults && result.platformResults.length > 0 && (
                    <View style={styles.tResultWrap}>
                      <View style={styles.tSummaryRow}>
                        <Text style={[styles.tSummaryText, { color: colors.textMuted }]}>
                          共测 {result.platformResults.length} 个平台 · {foundCount} 个找到歌曲
                        </Text>
                        {!ranAll && (
                          <Text style={[styles.tDelay, { color: colors.textMuted }]}>
                            {(result.delay || 0) / 1000 >= 1 ? `${((result.delay || 0) / 1000).toFixed(1)}s` : `${result.delay}ms`}
                          </Text>
                        )}
                      </View>
                      {result.platformResults.map((pr: PlatformQualityResult) => {
                        const pc = PLATFORM_COLORS[pr.platform] || colors.primary
                        return (
                          <View
                            key={pr.platform}
                            style={[styles.tPlatformRow, { backgroundColor: pr.found ? colors.background : platformRowBg, borderColor: colors.border }]}
                          >
                            <View style={styles.tPlatformLeft}>
                              <View style={[styles.tPlatformDot, { backgroundColor: pr.found ? pc : colors.textMuted }]} />
                              <Text style={[styles.tPlatformName, { color: pr.found ? colors.text : colors.textMuted }]}>
                                {pr.platformName}
                              </Text>
                            </View>
                            {pr.found ? (
                              <View style={styles.tChips}>
                                {TEST_QUALITY_ORDER.map(q => {
                                  const ql = QUALITY_LEVELS.find(x => x.key === q) as { key: string; label: string; color: string }
                                  const ok = pr.qualityResults[q]?.success
                                  return (
                                    <View
                                      key={q}
                                      style={
                                        ok
                                          ? [styles.tChip, { backgroundColor: isDark ? 'rgba(74,222,128,0.22)' : 'rgba(52,199,89,0.16)' }]
                                          : [styles.tChip, { backgroundColor: 'transparent', borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)' }]
                                      }
                                    >
                                      <Text
                                        style={
                                          ok
                                            ? [styles.tChipText, { color: isDark ? '#6ee79b' : '#1f9d55' }]
                                            : [styles.tChipText, { color: colors.textMuted, opacity: 0.5, textDecorationLine: 'line-through' }]
                                        }
                                      >
                                        {ql.label}
                                      </Text>
                                    </View>
                                  )
                                })}
                              </View>
                            ) : (
                              <Text style={[styles.tNotFound, { color: colors.textMuted }]}>未找到歌曲</Text>
                            )}
                          </View>
                        )
                      })}
                    </View>
                  )}
                </View>
              )
            })}
            {(!musicApis || musicApis.length === 0) && (
              <Text style={[styles.emptyText, { color: colors.textMuted, textAlign: 'center', padding: 20 }]}>暂无音源</Text>
            )}
          </ScrollView>
        )}

        {/* ===== 自动换源 ===== */}
        {activeTab === 'auto' && (
          <ScrollView style={styles.autoScroll} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <SFSymbol systemName="arrow.left.arrow.right" size={20} color={colors.text} style={styles.rowIcon} />
                  <Text style={styles.rowText}>启用自动换音源</Text>
                </View>
                <Switch value={autoEnabled} onValueChange={setAutoEnabled} trackColor={{ false: '#767577', true: '#34c759' }} />
              </View>
            </View>

            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <SFSymbol systemName="repeat" size={20} color={colors.text} style={styles.rowIcon} />
                  <Text style={styles.rowText}>最大换源尝试次数</Text>
                </View>
                <View style={styles.counter}>
                  <TouchableOpacity style={styles.counterBtn} onPress={() => setMaxAttempts(maxAttempts - 1)} disabled={!autoEnabled || maxAttempts <= 1}>
                    <Text style={[styles.counterBtnText, (!autoEnabled || maxAttempts <= 1) && styles.disabled]}>-</Text>
                  </TouchableOpacity>
                  <Text style={styles.counterValue}>{maxAttempts}</Text>
                  <TouchableOpacity style={styles.counterBtn} onPress={() => setMaxAttempts(maxAttempts + 1)} disabled={!autoEnabled || maxAttempts >= 20}>
                    <Text style={[styles.counterBtnText, (!autoEnabled || maxAttempts >= 20) && styles.disabled]}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <SFSymbol systemName="arrow.clockwise" size={20} color={colors.text} style={styles.rowIcon} />
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={styles.rowText}>优先重试3次</Text>
                    <Text style={styles.rowSubText}>当前音源失败后先重试3次再换源</Text>
                  </View>
                </View>
                <Switch value={priorityRetry} onValueChange={setPriorityRetry} disabled={!autoEnabled} trackColor={{ false: '#767577', true: '#34c759' }} />
              </View>
            </View>

            <View style={[styles.section, { backgroundColor: colors.card }]}>
              <Text style={styles.sectionTitle}>播放失败策略优先级</Text>
              <Text style={styles.sectionSub}>按顺序尝试，上一个策略全部失败后执行下一个</Text>
              {strategyPriority.map((strategy, index) => (
                <View key={strategy} style={[styles.strategyRow, !autoEnabled && styles.disabledRow]}>
                  <View style={[styles.strategyIndex, { backgroundColor: colors.primary }]}>
                    <Text style={styles.strategyIndexText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.strategyText}>{STRATEGY_LABELS[strategy]}</Text>
                  <View style={styles.strategyButtons}>
                    <TouchableOpacity onPress={() => moveUp(index)} disabled={!autoEnabled || index === 0} style={styles.moveBtn}>
                      <SFSymbol systemName="chevron.up" size={16} color={index === 0 || !autoEnabled ? colors.textMuted : colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => moveDown(index)} disabled={!autoEnabled || index === strategyPriority.length - 1} style={styles.moveBtn}>
                      <SFSymbol systemName="chevron.down" size={16} color={index === strategyPriority.length - 1 || !autoEnabled ? colors.textMuted : colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              <TouchableOpacity style={styles.resetBtn} onPress={() => setStrategyPriority([...DEFAULT_STRATEGY_ORDER])} disabled={!autoEnabled}>
                <Text style={[styles.resetBtnText, !autoEnabled && styles.disabled]}>恢复默认顺序</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoSection}>
              <SFSymbol systemName="info.circle" size={16} color={colors.textMuted} />
              <Text style={styles.infoText}>
                自动切换音源：尝试其他已启用的音源
                {'\n'}降低音质：当前音源内从高音质逐级降级
                {'\n'}播放下一首：全部失败后自动切下一首
              </Text>
            </View>
          </ScrollView>
        )}
      </View>

      {/* 日志弹窗 */}
      <Modal visible={showLogModal} transparent animationType="fade" onRequestClose={() => setShowLogModal(false)}>
        <View style={styles.logModalOverlay}>
          <TouchableOpacity style={styles.logModalBackdrop} activeOpacity={1} onPress={() => setShowLogModal(false)} />
          <View style={[styles.logModalContent, { backgroundColor: colors.card }]}>
            <View style={styles.logModalHeader}>
              <Text style={[styles.logModalTitle, { color: colors.text }]}>测试日志</Text>
              <TouchableOpacity onPress={() => setShowLogModal(false)}>
                <SFSymbol systemName="xmark" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.logModalBody}>
              <Text selectable style={[styles.logText, { color: colors.text }]}>{logText}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: colors.background },
    container: { flex: 1 },
    handle: {
      width: 36,
      height: 5,
      borderRadius: 3,
      backgroundColor: colors.textMuted + '40',
      alignSelf: 'center',
      marginTop: 8,
      marginBottom: 4,
    },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingBottom: 12 },
    headerTitle: { fontSize: 17, fontWeight: '600', letterSpacing: 0.2 },
    tabBar: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 14, padding: 4, borderRadius: 12, gap: 4, backgroundColor: colors.card },
    tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: 9 },
    tabItemActive: {
      shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 6, shadowOffset: { width: 0, height: 1 }, elevation: 2,
    },
    tabText: { fontSize: 14, fontWeight: '600' },
    tabTextActive: { color: colors.primary },

    // 音源管理
    sourceList: { flex: 1 },
    overviewCard: {
      borderRadius: 18, padding: 16, marginBottom: 14, marginTop: 4, minHeight: 88, justifyContent: 'center',
      shadowColor: colors.primary, shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4,
    },
    overviewRow: { flexDirection: 'row', alignItems: 'center' },
    overviewItem: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
    overviewValue: { fontSize: 18, fontWeight: '500', marginBottom: 2, textAlign: 'center', color: '#fff' },
    overviewLabel: { fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.8)' },
    overviewDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.2)' },
    sectionLabel: { fontSize: 13, fontWeight: '500', marginBottom: 8, letterSpacing: 0.2, color: colors.textMuted },

    sourceRow: {
      flexDirection: 'row', alignItems: 'center', borderRadius: 14,
      paddingVertical: 13, paddingHorizontal: 14, marginBottom: 8,
    },
    sourceRowActive: { borderWidth: 0 },
    activeIndicator: { position: 'absolute', left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2 },
    sourceRowInfo: { flex: 1, minWidth: 0 },
    sourceRowName: { fontSize: 15, fontWeight: '500' },
    sourceRowMeta: { fontSize: 12, marginTop: 2 },
    deleteBtn: { padding: 8, marginLeft: 4 },

    emptyContainer: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { fontSize: 14, marginTop: 12 },
    bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 1, borderTopColor: colors.border },
    builtinToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 14,
      marginHorizontal: 16,
      marginBottom: 70,
      borderRadius: 16,
    },
    builtinToggleLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    builtinIconWrapper: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
    builtinToggleText: { flex: 1 },
    builtinToggleTitle: { fontSize: 15, fontWeight: '500' },
    builtinToggleDesc: { fontSize: 12, marginTop: 2 },
    bottomContent: { flexDirection: 'row', padding: 16, gap: 12 },
    importBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 13, borderRadius: 14, gap: 6 },
    importBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },

    // 源测试
    testScroll: { flex: 1 },
    testButtonRow: { flexDirection: 'row', gap: 10, marginTop: 4, marginBottom: 12 },
    testActionBtn: { flex: 1, height: 42, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    startTestBtn: { backgroundColor: colors.primary },
    stopTestBtn: { backgroundColor: colors.primary, flex: 0.6 },
    logBtn: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, flex: 0.6 },
    testActionBtnText: { color: '#fff', fontSize: 14, fontWeight: '500' },
    logBtnText: { color: colors.text, fontSize: 14, fontWeight: '500' },
    disabledBtn: { opacity: 0.4 },
    testSettingsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
    testSettingsLabel: { fontSize: 13, fontWeight: '500' },
    testSettingsInput: { width: 55, height: 34, paddingHorizontal: 8, fontSize: 14, borderRadius: 8, textAlign: 'center' },
    elapsedText: { fontSize: 12, marginLeft: 'auto' },
    clearBtn: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: colors.primary, marginLeft: 'auto' },
    clearBtnText: { fontSize: 12, color: colors.primary, fontWeight: '500' },

    testCard: { borderRadius: 14, borderWidth: 1, marginBottom: 12, padding: 14 },
    testCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
    testCardName: { fontSize: 15, fontWeight: '500', flex: 1, marginRight: 10 },
    testCardBtn: { paddingHorizontal: 16, height: 30, backgroundColor: colors.primary, borderRadius: 8, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    testCardBtnDisabled: { opacity: 0.5 },
    testCardBtnText: { color: '#fff', fontSize: 13, fontWeight: '500' },
    testCardInput: { height: 38, paddingHorizontal: 12, fontSize: 14, borderRadius: 10, marginBottom: 4 },
    testResult: { marginTop: 8, gap: 6 },
    testingText: { fontSize: 12, fontWeight: '500' },
    resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    qualityBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
    qualityBadgeText: { fontSize: 12, color: '#fff', fontWeight: '500' },
    resultPlatform: { fontSize: 12, fontWeight: '500' },
    resultDelay: { fontSize: 12 },
    resultFail: { fontSize: 13, fontWeight: '500' },
    resultSong: { fontSize: 11, opacity: 0.7 },

    platformSummaryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
    platformSummaryCount: { fontSize: 12, fontWeight: '500' },
    platformDetailList: { marginTop: 6, gap: 6 },
    platformDetailItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    platformDetailName: { fontSize: 12, fontWeight: '500', width: 40, flexShrink: 0 },
    platformQualities: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, flex: 1 },
    platformQualityItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    platformQualityName: { fontSize: 11, fontWeight: '500' },
    platformQualityMark: { fontSize: 13, fontWeight: '500' },
    platformQualityText: { fontSize: 11, fontWeight: '500' },

    // ===== 源测试 v2（重设计） =====
    testControlCard: { borderRadius: 18, borderWidth: 1, padding: 14, marginTop: 4, marginBottom: 14 },
    testMainBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14 },
    testMainBtnText: { color: '#fff', fontSize: 15, fontWeight: '500' },
    testToolRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
    testToolLabel: { fontSize: 13, fontWeight: '500' },
    timeoutBox: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, height: 36 },
    timeoutInput: { width: 40, height: 36, fontSize: 14, textAlign: 'center', padding: 0 },
    testToolBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 36 },
    testToolBtnText: { fontSize: 13, fontWeight: '500' },

    tCard: { borderRadius: 18, padding: 14, marginBottom: 12 },
    tCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    tStatusDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    tCardName: { fontSize: 15, fontWeight: '500' },
    tCardSub: { fontSize: 11.5, marginTop: 2.5, color: '#8e8e93' },
    tQualityBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8, marginLeft: 2 },
    tQualityBadgeText: { fontSize: 11, fontWeight: '500' },
    tPlayBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginLeft: 2 },
    tSearchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, marginTop: 12, height: 40 },
    tSearchInput: { flex: 1, fontSize: 14, padding: 0 },
    tResultWrap: { marginTop: 12, gap: 8 },
    tSummaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    tSummaryText: { fontSize: 12, fontWeight: '500' },
    tDelay: { fontSize: 12, fontWeight: '500' },
    tPlatformRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 13, paddingHorizontal: 12, paddingVertical: 9, gap: 10 },
    tPlatformLeft: { flexDirection: 'row', alignItems: 'center', gap: 7, width: 60 },
    tPlatformDot: { width: 8, height: 8, borderRadius: 4 },
    tPlatformName: { fontSize: 13, fontWeight: '500' },
    tChips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 5 },
    tChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7 },
    tChipText: { fontSize: 10.5, fontWeight: '500' },
    tNotFound: { flex: 1, textAlign: 'right', fontSize: 12, fontWeight: '500' },
    tTotalBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 13, marginTop: 12, paddingVertical: 10 },
    tTotalItem: { flex: 1, alignItems: 'center', gap: 2 },
    tTotalNum: { fontSize: 17, fontWeight: '500' },
    tTotalLabel: { fontSize: 11, fontWeight: '500' },
    tTotalDivider: { width: 1, height: 26 },

    // 日志弹窗
    logModalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    logModalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
    logModalContent: { width: '100%', maxHeight: '70%', borderRadius: 16, overflow: 'hidden' },
    logModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 0.5, borderBottomColor: colors.border },
    logModalTitle: { fontSize: 17, fontWeight: '500' },
    logModalBody: { padding: 16, maxHeight: 400 },
    logText: { fontSize: 12, lineHeight: 18 },

    // 自动换源
    autoScroll: { flex: 1 },
    section: { marginBottom: 12, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 4 },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
    rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    rowIcon: { marginRight: 12 },
    rowText: { fontSize: 15, fontWeight: '500', color: colors.text },
    rowSubText: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
    counter: { flexDirection: 'row', alignItems: 'center' },
    counterBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
    counterBtnText: { fontSize: 20, fontWeight: '500', color: colors.text },
    counterValue: { fontSize: 16, fontWeight: '500', color: colors.text, minWidth: 32, textAlign: 'center' },
    disabled: { opacity: 0.3 },
    disabledRow: { opacity: 0.5 },
    sectionTitle: { fontSize: 15, fontWeight: '500', color: colors.text, marginTop: 12, marginBottom: 4 },
    sectionSub: { fontSize: 12, color: colors.textMuted, marginBottom: 8 },
    strategyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border },
    strategyIndex: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    strategyIndexText: { fontSize: 13, fontWeight: '500', color: '#fff' },
    strategyText: { flex: 1, fontSize: 15, fontWeight: '500', color: colors.text },
    strategyButtons: { flexDirection: 'row', gap: 4 },
    moveBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
    resetBtn: { paddingVertical: 12, alignItems: 'center' },
    resetBtnText: { fontSize: 14, fontWeight: '500', color: colors.primary },
    infoSection: { marginBottom: 24, flexDirection: 'row', gap: 8, marginTop: 8 },
    infoText: { fontSize: 12, color: colors.textMuted, lineHeight: 20, flex: 1 },
  })

export default SourceCenter
