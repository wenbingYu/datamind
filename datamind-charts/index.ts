/**
 * DataMind 高级图表模块
 * 
 * 功能：
 * - 12种图表类型支持（基础4种 + 高级8种）
 * - 8种预设主题 + 自定义主题
 * - 智能图表推荐
 * - 多格式导出（PNG/SVG/PDF/HTML/JSON）
 * 
 * @example
 * ```typescript
 * import { ChartGenerator, ChartRecommender, ChartExporter } from '@datamind/charts';
 * 
 * // 自动推荐图表
 * const recommender = new ChartRecommender();
 * const recommendations = recommender.recommend(data);
 * 
 * // 生成图表
 * const generator = new ChartGenerator('dark');
 * const chart = generator.generate(data, { type: 'heatmap', ... });
 * 
 * // 导出图表
 * const exporter = new ChartExporter();
 * await exporter.export(chart, { format: 'png', filename: 'my-chart' });
 * ```
 */

// 类型定义
export * from './types';

// 图表生成器
export { ChartGenerator, generateChart } from './generator';

// 图表导出器
export { ChartExporter, exportChart, inferExportFormat } from './export';

// 主题管理
export { ThemeManager, themeManager, INDUSTRY_THEMES } from './themes';

// 图表推荐
export { ChartRecommender, recommendChart, analyzeData, ChartRecommendation } from './recommender';

// 便捷方法
import { ChartGenerator } from './generator';
import { ChartExporter } from './export';
import { ChartRecommender } from './recommender';
import { ChartType, ChartOptions, ChartResult, ExportFormat, ExportOptions, ChartTheme } from './types';

/**
 * 一站式图表生成与导出
 */
export class DataMindCharts {
  private generator: ChartGenerator;
  private exporter: ChartExporter;
  private recommender: ChartRecommender;

  constructor(theme: ChartTheme = 'default') {
    this.generator = new ChartGenerator(theme);
    this.exporter = new ChartExporter();
    this.recommender = new ChartRecommender();
  }

  /**
   * 根据数据自动推荐并生成图表
   */
  autoGenerate(
    data: { columns: string[]; rows: any[][]; rowCount: number },
    options?: Partial<ChartOptions>
  ): ChartResult {
    const recommendations = this.recommender.recommend(data);
    const best = recommendations[0];
    
    if (!best) {
      throw new Error('无法生成图表：数据不适合任何图表类型');
    }
    
    return this.generator.generate(data, {
      type: best.type,
      ...best.suggestedColumns,
      ...options
    });
  }

  /**
   * 生成指定类型的图表
   */
  generate(
    data: { columns: string[]; rows: any[][]; rowCount: number },
    options: ChartOptions
  ): ChartResult {
    return this.generator.generate(data, options);
  }

  /**
   * 导出图表
   */
  async export(chart: ChartResult, options: ExportOptions): Promise<string> {
    return this.exporter.export(chart, options);
  }

  /**
   * 获取图表推荐
   */
  getRecommendations(data: { columns: string[]; rows: any[][]; rowCount: number }) {
    return this.recommender.recommend(data);
  }

  /**
   * 设置主题
   */
  setTheme(theme: ChartTheme): void {
    this.generator = new ChartGenerator(theme);
  }
}

// 默认实例
export const charts = new DataMindCharts();