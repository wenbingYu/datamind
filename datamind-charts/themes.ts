/**
 * DataMind 图表主题管理
 * 预设主题和自定义主题支持
 */

import { ChartTheme, ChartColors, CHART_THEMES } from './types';

/**
 * 主题管理器
 */
export class ThemeManager {
  private customThemes: Map<string, Partial<ChartColors>> = new Map();

  /**
   * 获取主题配置
   */
  getTheme(theme: ChartTheme): Partial<ChartColors> {
    if (theme === 'custom') {
      return this.customThemes.get('custom') || CHART_THEMES.default;
    }
    return CHART_THEMES[theme] || CHART_THEMES.default;
  }

  /**
   * 注册自定义主题
   */
  registerCustomTheme(name: string, colors: Partial<ChartColors>): void {
    this.customThemes.set(name, {
      ...CHART_THEMES.default,
      ...colors
    });
  }

  /**
   * 获取所有可用主题
   */
  getAvailableThemes(): { name: ChartTheme; label: string; preview: string }[] {
    return [
      { name: 'default', label: '默认', preview: '🔵' },
      { name: 'dark', label: '深色', preview: '🌙' },
      { name: 'vintage', label: '复古', preview: '📜' },
      { name: 'macarons', label: '马卡龙', preview: '🍬' },
      { name: 'shine', label: '闪耀', preview: '✨' },
      { name: 'roma', label: '罗马', preview: '🏛️' },
      { name: 'tech', label: '科技', preview: '🚀' },
      { name: 'forest', label: '森林', preview: '🌲' }
    ];
  }

  /**
   * 应用主题到 ECharts 配置
   */
  applyTheme(config: any, theme: ChartTheme): any {
    const colors = this.getTheme(theme);
    
    return {
      ...config,
      backgroundColor: config.backgroundColor || colors.background,
      color: colors.accent,
      title: {
        ...config.title,
        textStyle: {
          ...config.title?.textStyle,
          color: colors.text
        }
      },
      legend: {
        ...config.legend,
        textStyle: {
          ...config.legend?.textStyle,
          color: colors.text
        }
      },
      xAxis: config.xAxis ? {
        ...config.xAxis,
        axisLabel: {
          ...config.xAxis.axisLabel,
          color: colors.text
        },
        axisLine: {
          ...config.xAxis.axisLine,
          lineStyle: {
            ...config.xAxis.axisLine?.lineStyle,
            color: colors.grid
          }
        },
        splitLine: {
          ...config.xAxis.splitLine,
          lineStyle: {
            ...config.xAxis.splitLine?.lineStyle,
            color: colors.grid
          }
        }
      } : undefined,
      yAxis: config.yAxis ? {
        ...config.yAxis,
        axisLabel: {
          ...config.yAxis.axisLabel,
          color: colors.text
        },
        axisLine: {
          ...config.yAxis.axisLine,
          lineStyle: {
            ...config.yAxis.axisLine?.lineStyle,
            color: colors.grid
          }
        },
        splitLine: {
          ...config.yAxis.splitLine,
          lineStyle: {
            ...config.yAxis.splitLine?.lineStyle,
            color: colors.grid
          }
        }
      } : undefined
    };
  }

  /**
   * 生成主题预览 HTML
   */
  generateThemePreview(theme: ChartTheme): string {
    const colors = this.getTheme(theme);
    
    return `
<div style="
  background: ${colors.background};
  padding: 20px;
  border-radius: 8px;
  font-family: sans-serif;
">
  <div style="color: ${colors.text}; margin-bottom: 10px;">
    <strong>主题预览</strong>
  </div>
  <div style="display: flex; gap: 8px; margin-bottom: 10px;">
    ${colors.accent?.map((c, i) => `
      <div style="
        width: 30px;
        height: 30px;
        background: ${c};
        border-radius: 4px;
      "></div>
    `).join('') || ''}
  </div>
  <div style="
    height: 4px;
    background: linear-gradient(90deg, ${colors.accent?.join(', ')});
    border-radius: 2px;
  "></div>
  <div style="
    margin-top: 10px;
    color: ${colors.text};
    opacity: 0.7;
    font-size: 12px;
  ">
    Primary: ${colors.primary}<br>
    Background: ${colors.background}
  </div>
</div>
`;
  }
}

// 预定义的行业主题
export const INDUSTRY_THEMES = {
  finance: {
    name: '金融',
    colors: {
      primary: '#1a73e8',
      secondary: '#34a853',
      accent: ['#1a73e8', '#34a853', '#ea4335', '#fbbc04', '#4285f4'],
      background: '#ffffff',
      text: '#202124',
      grid: '#dadce0'
    }
  },
  healthcare: {
    name: '医疗',
    colors: {
      primary: '#00a19c',
      secondary: '#7bc043',
      accent: ['#00a19c', '#7bc043', '#0392cf', '#ee4035', '#f37736'],
      background: '#f8fffe',
      text: '#2d3436',
      grid: '#dfe6e9'
    }
  },
  retail: {
    name: '零售',
    colors: {
      primary: '#ff6b35',
      secondary: '#f7c59f',
      accent: ['#ff6b35', '#f7c59f', '#efa00b', '#d65108', '#591f0a'],
      background: '#fffef9',
      text: '#2d3436',
      grid: '#f0e6d3'
    }
  },
  technology: {
    name: '科技',
    colors: {
      primary: '#6366f1',
      secondary: '#8b5cf6',
      accent: ['#6366f1', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b'],
      background: '#0f0f23',
      text: '#e4e4f1',
      grid: '#2d2d5a'
    }
  },
  education: {
    name: '教育',
    colors: {
      primary: '#4f46e5',
      secondary: '#06b6d4',
      accent: ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'],
      background: '#fafafa',
      text: '#1f2937',
      grid: '#e5e7eb'
    }
  }
};

// 创建单例
export const themeManager = new ThemeManager();

// 注册行业主题
Object.entries(INDUSTRY_THEMES).forEach(([key, value]) => {
  themeManager.registerCustomTheme(key, value.colors);
});