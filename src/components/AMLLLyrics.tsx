import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { amllHtmlContent } from './amllHtmlContent';
import PersistStatus from '@/store/PersistStatus';
import { useAMLLSettingsStore } from '@/store/amllSettingsStore';

export interface LyricWordData {
  start: number;
  end: number;
  text: string;
}
export interface LyricLineData {
  time: number;
  end?: number;
  lrc: string;
  index: number;
  words?: LyricWordData[];
  translatedLyric?: string;
}

interface Props {
  lyrics: LyricLineData[];
  currentTime: number;
  isPlaying: boolean;
  albumArt?: string;
  alignPosition?: number;
  fontSize?: number;
  inactiveFontSize?: number;
  fontWeight?: number;
  lineMargin?: number;
  lyricAreaTop?: number;
  lyricBottom?: number;
  lyricPaddingTop?: number;
  lyricPaddingLeft?: number;
  lyricPaddingRight?: number;
  lyricPaddingBottom?: number;
  lyricTextAlign?: 'left' | 'center' | 'right';
  backgroundMode?: 'flowing' | 'static';
  showLyrics?: boolean;
  onSeek?: (time: number) => void;
  seekCommand?: { seq: number; time: number };
}

const AMLLLyrics: React.FC<Props> = ({
  lyrics,
  currentTime,
  isPlaying,
  albumArt,
  alignPosition = 0.5,
  fontSize = 22,
  inactiveFontSize = 16,
  fontWeight = 700,
  lineMargin = 16,
  lyricAreaTop = 236,
  lyricBottom = 280,
  lyricPaddingTop = 0,
  lyricPaddingLeft = 0,
  lyricPaddingRight = 0,
  lyricPaddingBottom = 0,
  lyricTextAlign = 'left',
  backgroundMode = 'flowing',
  showLyrics = true,
  onSeek,
  seekCommand,
}) => {
  const webViewRef = useRef<WebView>(null);
  const readyRef = useRef(false);
  const lastSeekSeqRef = useRef(0);
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const isPlayingRef = useRef(isPlaying);
  // AMLL 校准节流：每 500ms 才 force 校准一次，避免频繁重置内部时钟
  const lastSyncRef = useRef(0);
  // 歌词字体设置
  const { lyricFont, heitiFontWeight } = useAMLLSettingsStore();
  // 实际生效的字重：黑体模式用黑体字重，否则用传入的 fontWeight
  const effectiveFontWeight = lyricFont === 'heiti' ? heitiFontWeight : fontWeight;

  // 传给 AMLL 的时间 = 播放器时间 + 歌词偏移
  const getAmllTime = (t: number) => t + (PersistStatus.get('lyric.delaySeconds') ?? 0);

  const inject = (code: string) => {
    webViewRef.current?.injectJavaScript(code);
  };

  // 应用歌词容器布局和字重
  const applyLyricLayout = () => {
    const fontFamilyCss = lyricFont === 'heiti' ? 'font-family: "Heiti SC", "STHeiti", sans-serif !important;' : '';
    inject(`
      (function() {
        var el = document.getElementById('lyrics');
        if (el) {
          el.style.top = '${lyricAreaTop}px';
          el.style.bottom = '${lyricBottom + lyricPaddingBottom}px';
          el.style.paddingTop = '${lyricPaddingTop}px';
          el.style.paddingLeft = '${lyricPaddingLeft}px';
          el.style.paddingRight = '${lyricPaddingRight}px';
          el.style.paddingBottom = '0px';
          el.style.textAlign = '${lyricTextAlign}';
          el.style.opacity = '${showLyrics ? '1' : '0'}';
          el.style.pointerEvents = '${showLyrics ? 'auto' : 'none'}';
          el.style.overflow = 'hidden';
        }
        var styleId = 'amll-fw-override';
        var oldStyle = document.getElementById(styleId);
        if (oldStyle) oldStyle.remove();
        var style = document.createElement('style');
        style.id = styleId;
        style.textContent = 'div[class*="lyricLine"], div[class*="lyricBg"], div[class*="lyricSub"], .amll-lyric-player, .amll-lyric-player * { font-weight: ${effectiveFontWeight} !important; ${fontFamilyCss} }';
        document.head.appendChild(style);
      })();
      true;
    `);
  };

  // WebView 就绪后统一初始化
  const initAmll = () => {
    if (albumArt) inject(`window.amll.setAlbum(${JSON.stringify(albumArt)}); true;`);
    inject(`window.amll.setBackgroundMode('${backgroundMode}'); true;`);
    inject(`window.amll.setPlaying(${isPlaying}); true;`);
    if (lyrics.length > 0) {
      inject(`window.amll.setLyrics(${JSON.stringify(lyrics)}); true;`);
    }
    inject(`window.amll.setTime(${getAmllTime(currentTime)}, true); true;`);
    inject(`window.amll.setAlignPosition(${alignPosition}); true;`);
    inject(`window.amll.setFontStyle(${fontSize}, ${inactiveFontSize}, ${effectiveFontWeight}, ${lineMargin}); true;`);
    applyLyricLayout();
  };

  const handleLoadEnd = () => {
    if (!readyRef.current) {
      readyRef.current = true;
      initAmll();
    }
  };

  const handleMessage = (e: any) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'ready') {
        if (!readyRef.current) {
          readyRef.current = true;
          initAmll();
        }
      } else if (msg.type === 'seek') {
        // 点击歌词：先让 AMLL 立即跳转，再让播放器 seek
        inject(`window.amll.setTime(${msg.time}, true); true;`);
        const realTime = msg.time - (PersistStatus.get('lyric.delaySeconds') ?? 0);
        onSeek?.(realTime);
        // 1.5 秒后清除选中状态
        setTimeout(() => {
          inject(`
            (function() {
              if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
              var lines = document.querySelectorAll('[class*="lyricLineWrapper"]');
              for (var i = 0; i < lines.length; i++) {
                lines[i].blur && lines[i].blur();
                lines[i].classList.remove('active', 'selected', 'pressed');
              }
            })();
            true;
          `);
        }, 1500);
      }
    } catch {}
  };

  // 歌词更新
  useEffect(() => {
    inject(`window.amll.setLyrics(${JSON.stringify(lyrics)}); true;`);
  }, [lyrics]);

  // 正常播放：每 500ms force 校准一次（Sollin 式 250ms 更新 props），
  // 进度条保持 100ms 流畅更新，AMLL 校准节流避免频繁重置内部时钟
  useEffect(() => {
    const now = Date.now();
    if (now - lastSyncRef.current >= 500) {
      lastSyncRef.current = now;
      inject(`window.amll.setTime(${getAmllTime(currentTime)}, true); true;`);
    }
  }, [currentTime]);

  // 播放状态：暂停恢复时 force 校准一次
  useEffect(() => {
    inject(`window.amll.setPlaying(${isPlaying}); true;`);
    if (isPlaying && !isPlayingRef.current) {
      inject(`window.amll.setTime(${getAmllTime(currentTimeRef.current)}, true); true;`);
    }
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // seek 硬校准：拖动进度条/点击歌词跳转后立即 force 跳转
  useEffect(() => {
    if (!seekCommand || seekCommand.seq === lastSeekSeqRef.current) return;
    lastSeekSeqRef.current = seekCommand.seq;
    inject(`window.amll.setTime(${getAmllTime(seekCommand.time)}, true); true;`);
  }, [seekCommand]);

  // 封面
  useEffect(() => {
    if (albumArt) inject(`window.amll.setAlbum(${JSON.stringify(albumArt)}); true;`);
  }, [albumArt]);

  // 对齐位置
  useEffect(() => {
    inject(`window.amll.setAlignPosition(${alignPosition}); true;`);
  }, [alignPosition]);

  // 背景模式
  useEffect(() => {
    inject(`window.amll.setBackgroundMode('${backgroundMode}'); true;`);
  }, [backgroundMode]);

  // 歌词显示/隐藏
  useEffect(() => {
    inject(`
      (function() {
        var el = document.getElementById('lyrics');
        if (el) {
          el.style.opacity = '${showLyrics ? '1' : '0'}';
          el.style.pointerEvents = '${showLyrics ? 'auto' : 'none'}';
        }
      })();
      true;
    `);
  }, [showLyrics]);

  // 字体样式
  useEffect(() => {
    inject(`window.amll.setFontStyle(${fontSize}, ${inactiveFontSize}, ${effectiveFontWeight}, ${lineMargin}); true;`);
    setTimeout(() => applyLyricLayout(), 100);
  }, [fontSize, inactiveFontSize, effectiveFontWeight, lineMargin, lyricFont, heitiFontWeight]);

  // 布局
  useEffect(() => {
    applyLyricLayout();
  }, [lyricAreaTop, lyricBottom, lyricPaddingTop, lyricPaddingLeft, lyricPaddingRight, lyricPaddingBottom, lyricTextAlign, effectiveFontWeight, showLyrics, lyricFont, heitiFontWeight]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: amllHtmlContent }}
        onMessage={handleMessage}
        onLoadEnd={handleLoadEnd}
        originWhitelist={['*']}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        backgroundColor="transparent"
        style={styles.webview}
      />
    </View>
  );
};

export default AMLLLyrics;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
