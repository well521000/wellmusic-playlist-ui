const { withXcodeProject } = require('@expo/config-plugins')
const fs = require('fs')
const path = require('path')

/**
 * 把 native/ios/ 下的原生文件添加到 Xcode 工程
 * 包括：SFSymbol 组件、UserApiModule (JSC 音源引擎)
 * 手动操作 pbxproj 底层 API，确保文件被添加到 target 的 Compile Sources / Copy Bundle Resources
 */
module.exports = function withNativeIOS(config) {
  return withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults
    const projectRoot = config.modRequest.projectRoot
    const iosDir = path.join(projectRoot, 'ios')
    const nativeDir = path.join(projectRoot, 'native', 'ios')

    if (!fs.existsSync(nativeDir)) {
      console.log('[NativeIOS] native/ios directory not found, skipping')
      return config
    }

    // 需要编译的源文件（相对 native/ios/ 路径）
    const compileFiles = [
      'SFSymbolView.swift',
      'SFSymbolViewManager.m',
      'userapi/WellMusicUserApiModule.m',
      'userapi/WellMusicUserApiRuntime.m',
      'LiquidGlassDockView.swift',
      'LiquidGlassDockViewManager.m',
      'LiquidGlassTabBar.swift',
      'LiquidGlassTabBarManager.m',
      'LiquidGlassBackgroundView.swift',
      'LiquidGlassBackgroundViewManager.m',
      'NativeTabBarView.swift',
      'NativeTabBarViewManager.m',
      'LyricsView.swift',
      'LyricsViewManager.m',
      'BlurTextUIView.swift',
    ].filter(f => fs.existsSync(path.join(nativeDir, f)))

    // 头文件（只加入工程，不编译）
    const headerFiles = [
      'userapi/WellMusicUserApiRuntime.h',
      'LyricsViewManager.h',
    ].filter(f => fs.existsSync(path.join(nativeDir, f)))

    // 资源文件（加入 Copy Bundle Resources）
    const resourceFiles = [
      'userapi/user-api-preload.js',
    ].filter(f => fs.existsSync(path.join(nativeDir, f)))

    console.log(`[NativeIOS] Compile files: ${compileFiles.join(', ')}`)
    console.log(`[NativeIOS] Header files: ${headerFiles.join(', ')}`)
    console.log(`[NativeIOS] Resource files: ${resourceFiles.join(', ')}`)

    // 复制文件到 ios 目录（保持子目录结构）
    const allFiles = [...compileFiles, ...headerFiles, ...resourceFiles]
    for (const file of allFiles) {
      const src = path.join(nativeDir, file)
      const dst = path.join(iosDir, file)
      const dstDir = path.dirname(dst)
      if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true })
      fs.copyFileSync(src, dst)
      console.log(`[NativeIOS] Copied ${file}`)
    }

    // 获取主 target
    const nativeTargets = xcodeProject.pbxNativeTargetSection()
    const mainTargetUuid = Object.keys(nativeTargets).find(uuid => {
      const t = nativeTargets[uuid]
      return t && t.name && t.name !== 'undefined' && !t.name.toLowerCase().includes('test')
    })

    if (!mainTargetUuid) {
      console.log('[NativeIOS] No main target found, skipping')
      return config
    }

    const mainTarget = nativeTargets[mainTargetUuid]
    console.log(`[NativeIOS] Main target: ${mainTarget.name} (${mainTargetUuid})`)

    // 找到主 group
    const groups = xcodeProject.hash.project.objects['PBXGroup'] || {}
    const groupUuids = Object.keys(groups).filter(k => !k.endsWith('_comment'))
    let mainGroupUuid = groupUuids.find(uuid => groups[uuid]?.name === mainTarget.name)
    if (!mainGroupUuid) {
      mainGroupUuid = groupUuids.find(uuid => {
        const g = groups[uuid]
        return g && g.name && g.name !== 'Products' && g.name !== 'Frameworks'
      })
    }
    console.log(`[NativeIOS] Main group: ${mainGroupUuid ? groups[mainGroupUuid]?.name : 'none'}`)

    // 获取 Sources build phase 和 Resources build phase
    const sourcesPhase = xcodeProject.pbxSourcesBuildPhaseObj(mainTargetUuid)
    const resourcesPhase = xcodeProject.pbxResourcesBuildPhaseObj(mainTargetUuid)
    console.log(`[NativeIOS] Sources phase: ${sourcesPhase ? 'found' : 'NOT FOUND'}`)
    console.log(`[NativeIOS] Resources phase: ${resourcesPhase ? 'found' : 'NOT FOUND'}`)

    // 辅助函数：检查文件是否已在某个 build phase 里
    const isInPhase = (phase, fileName) => {
      if (!phase || !phase.files) return false
      return phase.files.some(f => f.comment && f.comment.includes(fileName))
    }

    // 辅助函数：添加文件引用到工程
    const addFileReference = (file) => {
      const fileObj = xcodeProject.addFile(file, mainGroupUuid, {})
      return fileObj
    }

    // 辅助函数：添加到 Compile Sources
    const addToSources = (file, fileRefUuid) => {
      if (isInPhase(sourcesPhase, file)) {
        console.log(`[NativeIOS] ${file} already in Sources, skipping`)
        return
      }
      const buildFileUuid = xcodeProject.generateUuid()
      xcodeProject.hash.project.objects['PBXBuildFile'][buildFileUuid] = {
        isa: 'PBXBuildFile',
        fileRef: fileRefUuid,
        fileRef_comment: file,
      }
      sourcesPhase.files.push({
        value: buildFileUuid,
        comment: `${file} in Sources`,
      })
      console.log(`[NativeIOS] Added ${file} to Compile Sources`)
    }

    // 辅助函数：添加到 Copy Bundle Resources
    const addToResources = (file, fileRefUuid) => {
      if (!resourcesPhase) {
        console.log(`[NativeIOS] ERROR: No Resources build phase, cannot add ${file}`)
        return
      }
      if (isInPhase(resourcesPhase, file)) {
        console.log(`[NativeIOS] ${file} already in Resources, skipping`)
        return
      }
      const buildFileUuid = xcodeProject.generateUuid()
      xcodeProject.hash.project.objects['PBXBuildFile'][buildFileUuid] = {
        isa: 'PBXBuildFile',
        fileRef: fileRefUuid,
        fileRef_comment: file,
      }
      resourcesPhase.files.push({
        value: buildFileUuid,
        comment: `${file} in Resources`,
      })
      console.log(`[NativeIOS] Added ${file} to Copy Bundle Resources`)
    }

    // 处理需要编译的源文件
    for (const file of compileFiles) {
      try {
        const fileObj = addFileReference(file)
        const fileRefUuid = fileObj ? fileObj.fileRef : xcodeProject.generateUuid()
        addToSources(file, fileRefUuid)
      } catch (e) {
        console.log(`[NativeIOS] Error adding compile file ${file}: ${e.message}`)
      }
    }

    // 处理头文件（只加文件引用，不编译）
    for (const file of headerFiles) {
      try {
        addFileReference(file)
        console.log(`[NativeIOS] Added header reference: ${file}`)
      } catch (e) {
        console.log(`[NativeIOS] Error adding header ${file}: ${e.message}`)
      }
    }

    // 处理资源文件
    for (const file of resourceFiles) {
      try {
        const fileObj = addFileReference(file)
        const fileRefUuid = fileObj ? fileObj.fileRef : xcodeProject.generateUuid()
        addToResources(file, fileRefUuid)
      } catch (e) {
        console.log(`[NativeIOS] Error adding resource ${file}: ${e.message}`)
      }
    }

    return config
  })
}
