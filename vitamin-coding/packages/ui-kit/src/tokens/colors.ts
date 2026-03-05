// Light 主题色板 — 基于 Dify light.css 变量体系翻译
export const lightColors = {
  // 背景层级
  bg: {
    body: '#f2f4f7',
    surface: '#ffffff',
    surfaceSubtle: '#fcfcfd',
    soft: '#f9fafb',
    hover: '#f9fafb',
    burn: '#e9ebf0',
    section: '#f9fafb',
    sectionBurn: '#f2f4f7',
    overlay: 'rgba(16, 24, 40, 0.6)',
    overlayAlt: 'rgba(16, 24, 40, 0.4)',
    overlayBackdrop: 'rgba(242, 244, 247, 0.95)',
  },

  // 文本层级
  text: {
    primary: '#101828',
    secondary: '#354052',
    tertiary: '#676f83',
    quaternary: 'rgba(16, 24, 40, 0.3)',
    placeholder: '#98a2b2',
    disabled: '#d0d5dc',
    accent: '#155aef',
    accentSecondary: '#296dff',
    destructive: '#d92d20',
    destructiveSecondary: '#f04438',
    success: '#079455',
    successSecondary: '#17b26a',
    warning: '#dc6803',
    warningSecondary: '#f79009',
    onSurface: '#ffffff',
    onSurfaceSecondary: 'rgba(255, 255, 255, 0.9)',
    logo: '#18222f',
    emptyStateIcon: '#d0d5dc',
  },

  // 分割线
  divider: {
    subtle: 'rgba(16, 24, 40, 0.04)',
    regular: 'rgba(16, 24, 40, 0.08)',
    deep: 'rgba(16, 24, 40, 0.14)',
    intense: 'rgba(16, 24, 40, 0.3)',
    solid: '#d0d5dc',
    solidAlt: '#98a2b2',
    accent: '#e5eaff',
    burn: 'rgba(16, 24, 40, 0.04)',
  },

  // 面板
  panel: {
    bg: '#ffffff',
    bgBlur: 'rgba(255, 255, 255, 0.95)',
    bgAlt: '#f9fafb',
    bgTransparent: 'rgba(255, 255, 255, 0)',
    border: 'rgba(16, 24, 40, 0.08)',
    borderSubtle: 'rgba(16, 24, 40, 0.08)',
    gradient1: '#ffffff',
    gradient2: '#f9fafb',
    onPanelItemBg: '#ffffff',
    onPanelItemBgHover: '#f9fafb',
    onPanelItemBgAlt: '#f9fafb',
  },

  // 卡片
  card: {
    bg: '#fcfcfd',
    bgAlt: '#ffffff',
    border: '#ffffff',
    bgTransparent: 'rgba(252, 252, 253, 0)',
  },

  // 输入框
  input: {
    bg: 'rgba(200, 206, 218, 0.25)',
    bgHover: 'rgba(200, 206, 218, 0.14)',
    bgActive: '#f9fafb',
    bgDisabled: 'rgba(200, 206, 218, 0.14)',
    bgDestructive: '#ffffff',
    borderActive: '#d0d5dc',
    borderHover: '#d0d5dc',
    borderDestructive: '#fda29b',
    text: '#101828',
    textDisabled: '#d0d5dc',
    textFilledDisabled: '#676f83',
    placeholder: '#98a2b2',
  },

  // 导航
  nav: {
    bg: 'rgba(255, 255, 255, 0.8)',
    text: '#495464',
    textActive: '#155aef',
    buttonBg: 'rgba(255, 255, 255, 0)',
    buttonBgActive: '#fcfcfd',
    buttonBgHover: 'rgba(16, 24, 40, 0.04)',
    buttonText: '#495464',
    buttonTextActive: '#155aef',
    buttonBorder: 'rgba(255, 255, 255, 0.95)',
    userBorder: '#ffffff',
  },

  // 按钮
  button: {
    primaryText: '#ffffff',
    primaryBg: '#155aef',
    primaryBgHover: '#004aeb',
    primaryBorder: 'rgba(16, 24, 40, 0.04)',
    primaryBgDisabled: 'rgba(21, 90, 239, 0.14)',
    secondaryText: '#354052',
    secondaryBg: '#ffffff',
    secondaryBgHover: '#f9fafb',
    secondaryBorder: 'rgba(16, 24, 40, 0.14)',
    secondaryBorderHover: 'rgba(16, 24, 40, 0.2)',
    tertiaryText: '#354052',
    tertiaryBg: '#f2f4f7',
    tertiaryBgHover: '#e9ebf0',
    ghostText: '#354052',
    ghostBgHover: 'rgba(200, 206, 218, 0.2)',
    destructivePrimaryBg: '#d92d20',
    destructivePrimaryBgHover: '#b42318',
    destructiveSecondaryText: '#d92d20',
    destructiveSecondaryBg: '#ffffff',
    destructiveSecondaryBgHover: '#fef3f2',
  },

  // 状态
  state: {
    hover: 'rgba(200, 206, 218, 0.2)',
    active: 'rgba(200, 206, 218, 0.4)',
    hoverAlt: 'rgba(200, 206, 218, 0.4)',
    hoverSubtle: 'rgba(200, 206, 218, 0.08)',
    handle: 'rgba(16, 24, 40, 0.2)',
    handleHover: 'rgba(16, 24, 40, 0.3)',
    accentHover: '#eff4ff',
    accentActive: 'rgba(21, 90, 239, 0.08)',
    accentHoverAlt: '#d1e0ff',
    accentSolid: '#296dff',
    destructiveHover: '#fef3f2',
    destructiveHoverAlt: '#fee4e2',
    destructiveActive: '#fecdca',
    destructiveSolid: '#f04438',
    destructiveBorder: '#fda29b',
    successHover: '#ecfdf3',
    successHoverAlt: '#dcfae6',
    successActive: '#abefc6',
    successSolid: '#17b26a',
    warningHover: '#fffaeb',
    warningHoverAlt: '#fef0c7',
    warningActive: '#fedf89',
    warningSolid: '#f79009',
  },

  // 品牌色（Dify blue-brand 色阶）
  brand: {
    50: '#f5f7ff',
    100: '#d1e0ff',
    200: '#b2caff',
    300: '#84abff',
    400: '#5289ff',
    500: '#296dff',
    600: '#155aef',
    700: '#004aeb',
  },

  // 状态指示灯
  status: {
    successBg: '#47cd89',
    successBorderInner: '#17b26a',
    successHalo: 'rgba(23, 178, 106, 0.25)',
    warningBg: '#fdb022',
    warningBorderInner: '#f79009',
    warningHalo: 'rgba(247, 144, 9, 0.25)',
    errorBg: '#f97066',
    errorBorderInner: '#f04438',
    errorHalo: 'rgba(240, 68, 56, 0.25)',
    normalBg: '#36bffa',
    normalBorderInner: '#0ba5ec',
    normalHalo: 'rgba(11, 165, 236, 0.25)',
    disabledBg: '#98a2b2',
    disabledBorderInner: '#676f83',
    disabledHalo: 'rgba(16, 24, 40, 0.04)',
    borderOuter: '#ffffff',
  },

  // Badge 软色
  badge: {
    greenSoft: 'rgba(23, 178, 106, 0.08)',
    orangeSoft: 'rgba(247, 144, 9, 0.08)',
    redSoft: 'rgba(240, 68, 56, 0.08)',
    blueLightSoft: 'rgba(11, 165, 236, 0.08)',
    graySoft: 'rgba(16, 24, 40, 0.04)',
  },

  // Chat 专用
  chat: {
    bgGradient1: '#f9fafb',
    bgGradient2: '#f2f4f7',
    bubbleBg1: '#ffffff',
    bubbleBg2: 'rgba(255, 255, 255, 0.6)',
    inputBgMask1: 'rgba(255, 255, 255, 0.01)',
    inputBgMask2: '#f2f4f7',
    inputBorder: '#ffffff',
    audioBg: '#eff4ff',
  },

  // 菜单项
  menu: {
    text: '#495464',
    textActive: '#18222f',
    textHover: '#354052',
    textActiveAccent: '#18222f',
    bgActive: 'rgba(21, 90, 239, 0.08)',
    bgHover: 'rgba(200, 206, 218, 0.2)',
  },

  // Tab
  tab: {
    active: '#155aef',
  },

  // 操作栏
  actionbar: {
    bg: 'rgba(255, 255, 255, 0.95)',
    border: 'rgba(16, 24, 40, 0.04)',
    bgAccent: '#f5f7ff',
    borderAccent: '#b2caff',
  },

  // 进度条
  progress: {
    brandProgress: '#296dff',
    brandBorder: '#296dff',
    brandBg: 'rgba(21, 90, 239, 0.04)',
    grayProgress: '#98a2b2',
    warningProgress: '#f79009',
    errorProgress: '#f04438',
  },

  // 效果
  effects: {
    highlight: '#ffffff',
    imageFrame: '#ffffff',
    iconBorder: 'rgba(16, 24, 40, 0.08)',
    highlightSubtle: 'rgba(255, 255, 255, 0.5)',
  },
} as const

// Dark 主题色板
export const darkColors = {
  bg: {
    body: '#17171a',
    surface: '#1e1f25',
    surfaceSubtle: '#25262d',
    soft: '#202127',
    hover: '#25262d',
    burn: '#141417',
    section: '#202127',
    sectionBurn: '#17171a',
    overlay: 'rgba(0, 0, 0, 0.6)',
    overlayAlt: 'rgba(0, 0, 0, 0.4)',
    overlayBackdrop: 'rgba(23, 23, 26, 0.95)',
  },

  text: {
    primary: '#f5f5f6',
    secondary: '#d0d5dc',
    tertiary: '#98a2b2',
    quaternary: 'rgba(255, 255, 255, 0.3)',
    placeholder: '#676f83',
    disabled: '#495464',
    accent: '#84abff',
    accentSecondary: '#5289ff',
    destructive: '#f97066',
    destructiveSecondary: '#fda29b',
    success: '#47cd89',
    successSecondary: '#75e0a7',
    warning: '#fdb022',
    warningSecondary: '#fedf89',
    onSurface: '#ffffff',
    onSurfaceSecondary: 'rgba(255, 255, 255, 0.9)',
    logo: '#f5f5f6',
    emptyStateIcon: '#495464',
  },

  divider: {
    subtle: 'rgba(255, 255, 255, 0.04)',
    regular: 'rgba(255, 255, 255, 0.08)',
    deep: 'rgba(255, 255, 255, 0.14)',
    intense: 'rgba(255, 255, 255, 0.3)',
    solid: '#495464',
    solidAlt: '#676f83',
    accent: '#2d3282',
    burn: 'rgba(255, 255, 255, 0.04)',
  },

  panel: {
    bg: '#1e1f25',
    bgBlur: 'rgba(30, 31, 37, 0.95)',
    bgAlt: '#25262d',
    bgTransparent: 'rgba(30, 31, 37, 0)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderSubtle: 'rgba(255, 255, 255, 0.06)',
    gradient1: '#1e1f25',
    gradient2: '#25262d',
    onPanelItemBg: '#25262d',
    onPanelItemBgHover: '#2c2d35',
    onPanelItemBgAlt: '#2c2d35',
  },

  card: {
    bg: '#25262d',
    bgAlt: '#1e1f25',
    border: '#2c2d35',
    bgTransparent: 'rgba(37, 38, 45, 0)',
  },

  input: {
    bg: 'rgba(255, 255, 255, 0.06)',
    bgHover: 'rgba(255, 255, 255, 0.08)',
    bgActive: '#25262d',
    bgDisabled: 'rgba(255, 255, 255, 0.04)',
    bgDestructive: '#1e1f25',
    borderActive: '#495464',
    borderHover: '#495464',
    borderDestructive: '#b42318',
    text: '#f5f5f6',
    textDisabled: '#495464',
    textFilledDisabled: '#676f83',
    placeholder: '#676f83',
  },

  nav: {
    bg: 'rgba(30, 31, 37, 0.8)',
    text: '#98a2b2',
    textActive: '#84abff',
    buttonBg: 'rgba(30, 31, 37, 0)',
    buttonBgActive: '#25262d',
    buttonBgHover: 'rgba(255, 255, 255, 0.06)',
    buttonText: '#98a2b2',
    buttonTextActive: '#84abff',
    buttonBorder: 'rgba(255, 255, 255, 0.06)',
    userBorder: '#2c2d35',
  },

  button: {
    primaryText: '#ffffff',
    primaryBg: '#296dff',
    primaryBgHover: '#155aef',
    primaryBorder: 'rgba(255, 255, 255, 0.06)',
    primaryBgDisabled: 'rgba(41, 109, 255, 0.2)',
    secondaryText: '#d0d5dc',
    secondaryBg: '#25262d',
    secondaryBgHover: '#2c2d35',
    secondaryBorder: 'rgba(255, 255, 255, 0.08)',
    secondaryBorderHover: 'rgba(255, 255, 255, 0.14)',
    tertiaryText: '#d0d5dc',
    tertiaryBg: '#2c2d35',
    tertiaryBgHover: '#35363e',
    ghostText: '#d0d5dc',
    ghostBgHover: 'rgba(255, 255, 255, 0.08)',
    destructivePrimaryBg: '#f04438',
    destructivePrimaryBgHover: '#d92d20',
    destructiveSecondaryText: '#f97066',
    destructiveSecondaryBg: '#25262d',
    destructiveSecondaryBgHover: 'rgba(240, 68, 56, 0.14)',
  },

  state: {
    hover: 'rgba(255, 255, 255, 0.06)',
    active: 'rgba(255, 255, 255, 0.1)',
    hoverAlt: 'rgba(255, 255, 255, 0.1)',
    hoverSubtle: 'rgba(255, 255, 255, 0.04)',
    handle: 'rgba(255, 255, 255, 0.14)',
    handleHover: 'rgba(255, 255, 255, 0.2)',
    accentHover: 'rgba(21, 90, 239, 0.14)',
    accentActive: 'rgba(21, 90, 239, 0.2)',
    accentHoverAlt: 'rgba(21, 90, 239, 0.25)',
    accentSolid: '#296dff',
    destructiveHover: 'rgba(240, 68, 56, 0.14)',
    destructiveHoverAlt: 'rgba(240, 68, 56, 0.2)',
    destructiveActive: 'rgba(240, 68, 56, 0.25)',
    destructiveSolid: '#f04438',
    destructiveBorder: 'rgba(240, 68, 56, 0.3)',
    successHover: 'rgba(23, 178, 106, 0.14)',
    successHoverAlt: 'rgba(23, 178, 106, 0.2)',
    successActive: 'rgba(23, 178, 106, 0.25)',
    successSolid: '#17b26a',
    warningHover: 'rgba(247, 144, 9, 0.14)',
    warningHoverAlt: 'rgba(247, 144, 9, 0.2)',
    warningActive: 'rgba(247, 144, 9, 0.25)',
    warningSolid: '#f79009',
  },

  brand: {
    50: '#1a1f35',
    100: '#1e2a4a',
    200: '#243568',
    300: '#2c4a8a',
    400: '#3d6abb',
    500: '#5289ff',
    600: '#84abff',
    700: '#b2caff',
  },

  status: {
    successBg: '#17b26a',
    successBorderInner: '#079455',
    successHalo: 'rgba(23, 178, 106, 0.25)',
    warningBg: '#f79009',
    warningBorderInner: '#dc6803',
    warningHalo: 'rgba(247, 144, 9, 0.25)',
    errorBg: '#f04438',
    errorBorderInner: '#d92d20',
    errorHalo: 'rgba(240, 68, 56, 0.25)',
    normalBg: '#0ba5ec',
    normalBorderInner: '#0086c9',
    normalHalo: 'rgba(11, 165, 236, 0.25)',
    disabledBg: '#676f83',
    disabledBorderInner: '#495464',
    disabledHalo: 'rgba(255, 255, 255, 0.06)',
    borderOuter: '#2c2d35',
  },

  badge: {
    greenSoft: 'rgba(23, 178, 106, 0.14)',
    orangeSoft: 'rgba(247, 144, 9, 0.14)',
    redSoft: 'rgba(240, 68, 56, 0.14)',
    blueLightSoft: 'rgba(11, 165, 236, 0.14)',
    graySoft: 'rgba(255, 255, 255, 0.06)',
  },

  chat: {
    bgGradient1: '#1e1f25',
    bgGradient2: '#17171a',
    bubbleBg1: '#25262d',
    bubbleBg2: 'rgba(37, 38, 45, 0.6)',
    inputBgMask1: 'rgba(30, 31, 37, 0.01)',
    inputBgMask2: '#25262d',
    inputBorder: '#2c2d35',
    audioBg: 'rgba(21, 90, 239, 0.14)',
  },

  menu: {
    text: '#98a2b2',
    textActive: '#f5f5f6',
    textHover: '#d0d5dc',
    textActiveAccent: '#f5f5f6',
    bgActive: 'rgba(21, 90, 239, 0.14)',
    bgHover: 'rgba(255, 255, 255, 0.06)',
  },

  tab: {
    active: '#84abff',
  },

  actionbar: {
    bg: 'rgba(30, 31, 37, 0.95)',
    border: 'rgba(255, 255, 255, 0.06)',
    bgAccent: 'rgba(21, 90, 239, 0.14)',
    borderAccent: 'rgba(21, 90, 239, 0.25)',
  },

  progress: {
    brandProgress: '#5289ff',
    brandBorder: '#5289ff',
    brandBg: 'rgba(21, 90, 239, 0.08)',
    grayProgress: '#676f83',
    warningProgress: '#f79009',
    errorProgress: '#f04438',
  },

  effects: {
    highlight: 'rgba(255, 255, 255, 0.06)',
    imageFrame: '#2c2d35',
    iconBorder: 'rgba(255, 255, 255, 0.08)',
    highlightSubtle: 'rgba(255, 255, 255, 0.04)',
  },
} as const

// 使用结构化类型（string 值）以兼容 light/dark 两套不同字面量
type DeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>
}

export type VitaminColorTokens = DeepStringify<typeof lightColors>
