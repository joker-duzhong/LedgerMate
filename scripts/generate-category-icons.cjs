const fs = require('node:fs')
const path = require('node:path')

const palette = {
  ink: '#292A2B', red: '#FF5874', orange: '#FFAA35', yellow: '#FFDF43',
  green: '#6ED779', blue: '#548FF3', purple: '#A66DE4', white: '#FFFFFF',
}
const groups = [
  { type: 'income', label: '收入', expected: 17, icons: require('./category-icons/income.cjs')(palette) },
  {
    type: 'expense', label: '支出', expected: 28,
    icons: [
      ...require('./category-icons/expense-daily.cjs')(palette),
      ...require('./category-icons/expense-life.cjs')(palette),
    ],
  },
]
const output = path.resolve(__dirname, '../src/static/icons/categories')
const escapeXml = (value) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character])

// Validate the entire catalog before writing so incomplete definitions cannot leave a partial set.
for (const group of groups) {
  if (group.icons.length !== group.expected) throw new Error(`${group.type}: expected ${group.expected} icons`)
  const names = new Set()
  const labels = new Set()
  for (const icon of group.icons) {
    if (!/^[a-z]+(?:-[a-z]+)*$/.test(icon.name) || names.has(icon.name) || labels.has(icon.label)) {
      throw new Error(`Invalid or duplicate category: ${group.type}/${icon.name}`)
    }
    if (!icon.label || !icon.body || /<(?:svg|script|text|image|foreignObject)\b|\b(?:href|on\w+)\s*=|url\(/i.test(icon.body)) {
      throw new Error(`Category must contain only local vector artwork: ${group.type}/${icon.name}`)
    }
    names.add(icon.name)
    labels.add(icon.label)
  }
}

const catalog = []
for (const group of groups) {
  const directory = path.join(output, group.type)
  fs.mkdirSync(directory, { recursive: true })
  for (const icon of group.icons) {
    const file = `${group.type}/${icon.name}.svg`
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="${palette.ink}" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round" role="img" aria-labelledby="title">
  <title id="title">${escapeXml(group.label + ' · ' + icon.label)}</title>
  ${icon.body.trim()}
</svg>
`
    fs.writeFileSync(path.join(output, file), svg, 'utf8')
    catalog.push({ type: group.type, name: icon.name, label: icon.label, file, src: `/static/icons/categories/${file}` })
  }
}
fs.writeFileSync(path.join(output, 'manifest.json'), JSON.stringify({ version: 1, size: 64, viewBox: '0 0 64 64', strokeWidth: 2.7, icons: catalog }, null, 2) + '\n', 'utf8')

const rows = groups.map((group) => `## ${group.label}（${group.expected} 个）

| 分类 | SVG 文件 |
| --- | --- |
${catalog.filter((icon) => icon.type === group.type).map((icon) => `| ${icon.label} | [${icon.file}](${icon.file}) |`).join('\n')}`).join('\n\n')
const readme = `# 分类图标

根据用户提供的两张分类截图绘制，共 45 个 SVG：收入 17 个、支出 28 个。彩色填充、圆角深色描边；透明背景，不包含白色圆底或分类文字。

- 画布：64 × 64，描边：2.7；建议显示尺寸 32–64 px，SVG 可无损缩放。
- [打开全部图标预览](preview.html)，可切换显示尺寸和透明背景检查；离线直接打开即可。
- [manifest.json](manifest.json) 提供收支类型、中文分类名、文件名、相对路径和应用访问路径。
- 人情社交、其他等跨收支同名分类按目录区分，查找时同时使用 type 和 label。
- SVG 中的货币符号均由路径绘制，不依赖字体、外部图片或网络资源。

## 在项目中使用

源目录是 src/static/icons/categories，uni-app 访问路径是 /static/icons/categories。

\`\`\`vue
<image src="/static/icons/categories/income/salary.svg" mode="aspectFit" style="width: 64rpx; height: 64rpx;" />
\`\`\`

本批为独立素材。现有 AppIcon 的名称白名单与 categoryIcon 的映射尚未接入这套图标；直接使用上面的 image 路径即可显示。白色圆底由使用页面的容器样式提供。

## 重新生成

在仓库根目录执行：

\`\`\`powershell
node scripts/generate-category-icons.cjs
\`\`\`

图形源定义在 scripts/category-icons/ 的三个 CommonJS 文件中。请修改源定义后重新生成；脚本会更新这 45 个 SVG、manifest.json、README.md 和 preview.html，不修改其他图标集。全部文件使用 UTF-8。

${rows}
`
fs.writeFileSync(path.join(output, 'README.md'), readme, 'utf8')

const sections = groups.map((group) => `<section aria-labelledby="${group.type}-title">
      <div class="section-heading"><h2 id="${group.type}-title">${group.label}</h2><span>${group.expected} 个分类</span></div>
      <div class="grid">${catalog.filter((icon) => icon.type === group.type).map((icon) => `
        <a class="item" href="${icon.file}" title="查看 ${escapeXml(icon.label)} SVG">
          <span class="disc"><img src="${icon.file}" width="64" height="64" alt="" /></span>
          <span class="label">${escapeXml(icon.label)}</span>
          <code>${icon.name}</code>
        </a>`).join('')}
      </div>
    </section>`).join('\n')

const preview = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>账伴 · 分类图标</title>
  <style>
    * { box-sizing: border-box; }
    :root { --icon-size: 64px; color: #292A2B; font: 15px/1.5 system-ui, 'Microsoft YaHei', sans-serif; background: #FAF7ED; }
    body { margin: 0; background-image: linear-gradient(#EAE4D233 1px, transparent 1px), linear-gradient(90deg, #EAE4D233 1px, transparent 1px); background-size: 28px 28px; }
    main { max-width: 1280px; margin: 0 auto; padding: 40px 28px 48px; }
    header { margin-bottom: 28px; }
    .eyebrow { margin: 0 0 8px; color: #766A42; font-size: 13px; }
    h1 { font-size: 30px; margin: 0 0 10px; font-weight: 650; }
    .intro { margin: 0; color: #68685E; }
    .toolbar { display: flex; align-items: center; flex-wrap: wrap; gap: 16px 24px; padding: 18px 0; border-block: 1px solid #DFD6BA; margin-bottom: 28px; }
    fieldset { border: 0; padding: 0; margin: 0; display: flex; align-items: center; gap: 8px; }
    legend { float: left; margin-right: 12px; }
    button { border: 1px solid #D8CBA3; background: white; color: inherit; font: inherit; padding: 7px 12px; border-radius: 9px; cursor: pointer; min-height: 40px; }
    button[aria-pressed="true"] { background: #FFDF43; border-color: #CBB23B; }
    .background-toggle { display: flex; align-items: center; gap: 7px; cursor: pointer; min-height: 40px; }
    input { width: 17px; height: 17px; accent-color: #766126; }
    a { color: inherit; }
    .toolbar > a { color: #645326; text-underline-offset: 4px; }
    a:focus-visible, button:focus-visible, input:focus-visible { outline: 3px solid #548FF3; outline-offset: 4px; }
    .sheets { display: grid; grid-template-columns: 1fr 1fr; gap: 44px; align-items: start; }
    .section-heading { display: flex; gap: 12px; align-items: baseline; border-bottom: 1px solid #DFD6BA; padding-bottom: 12px; margin-bottom: 12px; }
    h2 { margin: 0; font-size: 21px; font-weight: 650; }
    .section-heading span { color: #767265; font-size: 13px; }
    .grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 20px 8px; }
    .item { display: flex; flex-direction: column; align-items: center; text-align: center; text-decoration: none; min-width: 0; padding: 8px 0; border-radius: 12px; }
    .disc { display: grid; place-items: center; width: 84px; height: 84px; border-radius: 50%; background: #FFF; }
    .disc img { display: block; width: var(--icon-size); height: var(--icon-size); }
    .label { margin-top: 10px; font-size: 16px; }
    code { max-width: 100%; font-size: 10px; color: #79776B; overflow-wrap: anywhere; margin-top: 3px; }
    .item:hover .label { text-decoration: underline; text-underline-offset: 4px; }
    .checker .disc { border-radius: 10px; background: repeating-conic-gradient(#E6E3DC 0% 25%, #FFF 0% 50%) 0 0 / 12px 12px; }
    footer { margin-top: 32px; color: #79776B; font-size: 13px; }
    @media (max-width: 1060px) { .sheets { grid-template-columns: 1fr; gap: 36px; } main { max-width: 740px; } }
    @media (max-width: 480px) { main { padding: 24px 16px; } h1 { font-size: 26px; } .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
    @media print { .toolbar { display: none; } main { padding: 0; } .sheets { gap: 24px; } .item { break-inside: avoid; } }
  </style>
</head>
<body>
  <main>
    <header><p class="eyebrow">账伴 / 本地素材库</p><h1>每一笔，都有自己的图标。</h1><p class="intro">45 个分类 · 彩色圆角描边 · 透明背景 SVG</p></header>
    <div class="toolbar">
      <fieldset><legend>显示尺寸</legend><button type="button" data-size="32" aria-pressed="false">32 px</button><button type="button" data-size="48" aria-pressed="false">48 px</button><button type="button" data-size="64" aria-pressed="true">64 px</button></fieldset>
      <label class="background-toggle"><input type="checkbox" id="checker" /> 检查透明背景</label>
      <a href="README.md">分类文件对照</a>
    </div>
    <div class="sheets">
    ${sections}
    </div>
    <footer>点击图标可打开原始 SVG。圆形白底仅用于预览，不包含在图标文件中。</footer>
  </main>
  <script>
    document.querySelectorAll('[data-size]').forEach((button) => {
      button.addEventListener('click', () => {
        document.documentElement.style.setProperty('--icon-size', button.dataset.size + 'px');
        document.querySelectorAll('[data-size]').forEach((item) => item.setAttribute('aria-pressed', String(item === button)));
      });
    });
    document.getElementById('checker').addEventListener('change', (event) => {
      document.body.classList.toggle('checker', event.target.checked);
    });
  </script>
</body>
</html>
`
fs.writeFileSync(path.join(output, 'preview.html'), preview, 'utf8')
console.log(`Generated ${catalog.length} category icons (17 income + 28 expense), manifest, README and preview in ${output}`)
