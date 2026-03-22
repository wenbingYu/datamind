/**
 * DataMind 高级图表模块测试示例
 */

import { 
  ChartGenerator, 
  ChartRecommender, 
  ChartExporter,
  ChartType,
  ChartTheme
} from './index';

// 示例数据
const salesData = {
  columns: ['product', 'region', 'quarter', 'sales', 'profit'],
  rows: [
    ['iPhone', 'East', 'Q1', 150000, 45000],
    ['iPhone', 'East', 'Q2', 165000, 52000],
    ['iPhone', 'West', 'Q1', 180000, 55000],
    ['iPhone', 'West', 'Q2', 195000, 62000],
    ['MacBook', 'East', 'Q1', 120000, 36000],
    ['MacBook', 'East', 'Q2', 135000, 42000],
    ['MacBook', 'West', 'Q1', 145000, 45000],
    ['MacBook', 'West', 'Q2', 160000, 50000],
    ['iPad', 'East', 'Q1', 80000, 24000],
    ['iPad', 'East', 'Q2', 92000, 28000],
    ['iPad', 'West', 'Q1', 95000, 29000],
    ['iPad', 'West', 'Q2', 110000, 35000]
  ],
  rowCount: 12
};

const funnelData = {
  columns: ['stage', 'count'],
  rows: [
    ['访问', 100000],
    ['注册', 45000],
    ['激活', 28000],
    ['付费', 8500],
    ['续费', 6200]
  ],
  rowCount: 5
};

const radarData = {
  columns: ['skill', 'score', 'benchmark'],
  rows: [
    ['技术能力', 85, 70],
    ['沟通能力', 78, 75],
    ['项目管理', 92, 80],
    ['创新思维', 88, 75],
    ['团队协作', 95, 85],
    ['学习能力', 90, 80]
  ],
  rowCount: 6
};

const heatmapData = {
  columns: ['weekday', 'hour', 'visits'],
  rows: [
    ['Mon', '09:00', 1250],
    ['Mon', '12:00', 3400],
    ['Mon', '18:00', 2800],
    ['Tue', '09:00', 1450],
    ['Tue', '12:00', 3200],
    ['Tue', '18:00', 2650],
    ['Wed', '09:00', 1380],
    ['Wed', '12:00', 3500],
    ['Wed', '18:00', 2900],
    ['Thu', '09:00', 1520],
    ['Thu', '12:00', 3800],
    ['Thu', '18:00', 3100],
    ['Fri', '09:00', 1100],
    ['Fri', '12:00', 2900],
    ['Fri', '18:00', 2400]
  ],
  rowCount: 15
};

async function runTests() {
  console.log('📊 DataMind 高级图表模块测试\n');
  console.log('='.repeat(50));

  // 1. 测试图表推荐
  console.log('\n🎯 测试智能图表推荐...\n');
  
  const recommender = new ChartRecommender();
  
  console.log('销售数据推荐:');
  const salesRecs = recommender.recommend(salesData);
  salesRecs.slice(0, 3).forEach((rec, i) => {
    console.log(`  ${i + 1}. ${rec.type} (置信度: ${(rec.confidence * 100).toFixed(0)}%)`);
    console.log(`     原因: ${rec.reason}`);
  });

  console.log('\n漏斗数据推荐:');
  const funnelRecs = recommender.recommend(funnelData);
  console.log(`  推荐: ${funnelRecs[0].type}`);
  console.log(`  原因: ${funnelRecs[0].reason}`);

  // 2. 测试图表生成
  console.log('\n📈 测试图表生成...\n');
  
  const generator = new ChartGenerator('default');

  // 生成柱状图
  const barChart = generator.generate(salesData, {
    type: 'bar',
    title: '产品销售额对比',
    xColumn: 'product',
    yColumn: 'sales'
  });
  console.log('柱状图生成成功');
  console.log(`  洞察: ${barChart.insights?.join(', ')}`);

  // 生成漏斗图
  const funnelChart = generator.generate(funnelData, {
    type: 'funnel',
    title: '用户转化漏斗',
    stageColumn: 'stage',
    valueColumn: 'count'
  });
  console.log('漏斗图生成成功');
  console.log(`  洞察: ${funnelChart.insights?.slice(0, 3).join(', ')}`);

  // 生成热力图
  const heatmapChart = generator.generate(heatmapData, {
    type: 'heatmap',
    title: '访问时段热力图',
    xColumn: 'weekday',
    yColumn: 'hour',
    valueColumn: 'visits'
  });
  console.log('热力图生成成功');
  console.log(`  洞察: ${heatmapChart.insights?.join(', ')}`);

  // 生成雷达图
  const radarChart = generator.generate(radarData, {
    type: 'radar',
    title: '能力雷达图',
    dimensions: ['skill', 'score', 'benchmark']
  });
  console.log('雷达图生成成功');

  // 3. 测试主题
  console.log('\n🎨 测试主题切换...\n');
  
  const themes: ChartTheme[] = ['default', 'dark', 'tech', 'forest'];
  
  for (const theme of themes) {
    const themedGenerator = new ChartGenerator(theme);
    const chart = themedGenerator.generate(salesData, {
      type: 'bar',
      title: `${theme} 主题示例`
    });
    console.log(`  ${theme} 主题: ${chart.theme}`);
  }

  // 4. 测试导出
  console.log('\n💾 测试图表导出...\n');
  
  const exporter = new ChartExporter();
  
  // 导出为 JSON
  const jsonPath = await exporter.export(barChart, {
    format: 'json',
    filename: 'test-bar-chart',
    outputDir: '/tmp/datamind-charts'
  });
  console.log(`  JSON 导出: ${jsonPath}`);

  // 导出为 HTML
  const htmlPath = await exporter.export(funnelChart, {
    format: 'html',
    filename: 'test-funnel-chart',
    outputDir: '/tmp/datamind-charts',
    width: 800,
    height: 600
  });
  console.log(`  HTML 导出: ${htmlPath}`);

  // 5. 测试高级图表
  console.log('\n📊 测试所有图表类型...\n');
  
  const allTypes: ChartType[] = [
    'bar', 'line', 'pie', 'scatter',
    'heatmap', 'radar', 'funnel', 'treemap', 'sankey',
    'gauge', 'boxplot', 'candlestick'
  ];

  for (const type of allTypes) {
    try {
      // 根据类型准备合适的测试数据
      let testData = salesData;
      let options: any = { type };
      
      if (type === 'funnel') {
        testData = funnelData;
        options = { type, stageColumn: 'stage', valueColumn: 'count' };
      } else if (type === 'heatmap') {
        testData = heatmapData;
        options = { type, xColumn: 'weekday', yColumn: 'hour', valueColumn: 'visits' };
      } else if (type === 'radar') {
        testData = radarData;
        options = { type };
      } else if (type === 'gauge') {
        testData = { columns: ['value'], rows: [[75]], rowCount: 1 };
        options = { type, valueColumn: 'value', min: 0, max: 100 };
      }
      
      const chart = generator.generate(testData, options);
      console.log(`  ✅ ${type.padEnd(12)} - ${chart.description || 'OK'}`);
    } catch (e) {
      console.log(`  ❌ ${type.padEnd(12)} - 错误: ${(e as Error).message}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('✅ 测试完成!\n');
}

// 运行测试
runTests().catch(console.error);

export { runTests };