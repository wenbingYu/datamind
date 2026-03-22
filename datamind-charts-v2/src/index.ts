/**
 * DataMind 高级图表模块
 */

export * from './types';
export { ChartGenerator, generateChart } from './generator';
export { ChartExporter, exportChart, inferExportFormat } from './exporter';
export { ChartRecommender, recommendChart, analyzeData, ChartRecommendation } from './recommender';

import { ChartGenerator } from './generator';
import { ChartExporter } from './exporter';
import { ChartRecommender } from './recommender';
import { ChartOptions, ChartResult, ExportOptions, ChartTheme } from './types';

export class DataMindCharts {
  private generator: ChartGenerator;
  private exporter: ChartExporter;
  private recommender: ChartRecommender;

  constructor(theme: ChartTheme = 'default') {
    this.generator = new ChartGenerator(theme);
    this.exporter = new ChartExporter();
    this.recommender = new ChartRecommender();
  }

  autoGenerate(data: { columns: string[]; rows: any[][]; rowCount: number }, options?: Partial<ChartOptions>): ChartResult {
    const recommendations = this.recommender.recommend(data);
    const best = recommendations[0];
    if (!best) throw new Error('无法生成图表');
    return this.generator.generate(data, { type: best.type, ...best.suggestedColumns, ...options } as ChartOptions);
  }

  generate(data: { columns: string[]; rows: any[][]; rowCount: number }, options: ChartOptions): ChartResult {
    return this.generator.generate(data, options);
  }

  async export(chart: ChartResult, options: ExportOptions): Promise<string> {
    return this.exporter.export(chart, options);
  }

  getRecommendations(data: { columns: string[]; rows: any[][]; rowCount: number }) {
    return this.recommender.recommend(data);
  }

  setTheme(theme: ChartTheme): void {
    this.generator = new ChartGenerator(theme);
  }
}

export const charts = new DataMindCharts();