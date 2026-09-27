const fs = require('node:fs')
const path = require('node:path')

// 24 × 24 圆端线性图标。各色作为本地资源输出，避免依赖网络或小程序 CSS mask。
const icons = {
  ledger: '<rect x="5" y="3" width="15" height="18" rx="3"/><path d="M8 3v18M12 8h4M12 12h4M3 7h4M3 12h4M3 17h4"/>',
  chart: '<path d="M4 4v16h17M8 15v-4M13 15V6M18 15V9"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  settings: '<path d="M4 7h2M12 7h8M4 17h9M19 17h1"/><circle cx="9" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
  'chevron-left': '<path d="m14 5-7 7 7 7"/>',
  'chevron-right': '<path d="m9 5 7 7-7 7"/>',
  'chevron-down': '<path d="m5 9 7 7 7-7"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4M17 3v4M3 10h18M8 14h2M14 14h2M8 17h2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  wallet: '<path d="M20 8V5a2 2 0 0 0-2-2H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a2 2 0 0 0 2-2v-3M3 6a2 2 0 0 0 2 2h15v8h-5a4 4 0 0 1 0-8"/><path d="M16 12h1"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
  backspace: '<path d="M20 5H8L3 12l5 7h12a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Z"/><path d="m10 9 4 6m0-6-4 6"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15l-1 5ZM13 21h8"/>',
  'arrow-up': '<path d="M12 19V5m-6 6 6-6 6 6"/>',
  'arrow-down': '<path d="M12 5v14m-6-6 6 6 6-6"/>',
  food: '<path d="M4 3v6a3 3 0 0 0 6 0V3M7 3v18M17 3c-3 3-3 7 0 9h3V3h-3ZM20 12v9"/>',
  shopping: '<path d="M5 7h14l2 14H3L5 7ZM8 8V6a4 4 0 0 1 8 0v2"/>',
  transport: '<rect x="4" y="3" width="16" height="16" rx="4"/><path d="M4 10h16M8 19l-2 3M16 19l2 3M8 14h1M15 14h1M10 6h4"/>',
  home: '<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7"/>',
  health: '<rect x="3" y="6" width="18" height="15" rx="3"/><path d="M8 6V3h8v3M12 10v7M8.5 13.5h7"/>',
  education: '<path d="M12 5C8 2 4 3 2 4v15c3-2 7-1 10 1 3-2 7-3 10-1V4c-2-1-6-2-10 1ZM12 5v15"/>',
  gift: '<path d="M4 11h16v10H4V11ZM3 7h18v4H3V7ZM12 7v14"/><path d="M12 7C6 8 4 3 7 2c3-1 5 5 5 5s2-6 5-5c3 1 1 6-5 5Z"/>',
  salary: '<rect x="3" y="7" width="18" height="14" rx="3"/><path d="M8 7V3h8v4M3 12c6 3 12 3 18 0M12 12v4"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  refresh: '<path d="M20 7a9 9 0 0 0-16 1M20 3v5h-5M4 17a9 9 0 0 0 16-1M4 21v-5h5"/>',
  leaf: '<path d="M20 3C5 2 1 10 6 17c7 5 15 1 14-14ZM4 21l11-11"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  upload: '<path d="M12 15V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  shield: '<path d="M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6l-9-4Z"/><path d="m8 12 3 3 5-6"/>',
  logout: '<path d="M10 3H4v18h6M9 12h12m-4-4 4 4-4 4"/>',
}
const tones = { brand: '#5B4A16', muted: '#89897D', ink: '#292A25', income: '#188544', expense: '#188544', white: '#FFFFFF', color: '#34352F' }
const fills = { ledger: '#FFE06A', chart: '#FFE06A', wallet: '#FFE06A', settings: '#FFE06A', shopping: '#B47AF1', food: '#FF727B', transport: '#69DDA8', home: '#7DAEF6', health: '#FA8C95', education: '#80B2FF', gift: '#FF7F99', salary: '#A6C9F8', calendar: '#FFE477', leaf: '#A5D787' }
for (const [tone, color] of Object.entries(tones)) {
  const directory = path.resolve(__dirname, '../src/static/icons', tone)
  fs.mkdirSync(directory, { recursive: true })
  for (const [name, shapes] of Object.entries(icons)) {
    let art = shapes
    if (tone === 'color') {
      const fill = fills[name] || '#FFE477'
      art = art.replace(/<(rect|circle) /g, `<$1 fill="${fill}" `).replace(/<path d="([^"]*[Zz][^"]*)"/g, `<path fill="${fill}" d="$1"`)
      if (name === 'food') art = '<path stroke="#ED596B" stroke-width="3" d="M4 3v6a3 3 0 0 0 6 0V3M7 3v18"/><path fill="#FFCF59" d="M17 3c-3 3-3 7 0 9h3V3h-3ZM20 12v9"/>'
      if (name === 'chart') art = '<rect x="3" y="3" width="18" height="18" rx="3" fill="#FFE06A"/><path d="M7 16v-4M12 16V8M17 16v-6M8 1v4M16 1v4"/>'
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${art}</svg>\n`
    fs.writeFileSync(path.join(directory, `${name}.svg`), svg, 'utf8')
  }
}
console.log(`Generated ${Object.keys(icons).length} icons in ${Object.keys(tones).length} colors.`)
