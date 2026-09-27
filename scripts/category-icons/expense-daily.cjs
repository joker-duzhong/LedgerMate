module.exports = (p) => [
  {
    name: 'food',
    label: '餐饮',
    body: `
      <path d="M10 9h20v19c0 5-3 8-7 9v15a3 3 0 0 1-6 0V37c-4-1-7-4-7-9Z" fill="${p.red}"/>
      <path d="M17 9v15M23 9v15"/>
      <path d="M51 9c-9 0-15 9-15 20 0 6 3 10 9 11v12a3 3 0 0 0 6 0Z" fill="${p.orange}"/>
      <path d="M13.5 13v14M46 15c-4 3-6 8-6 13" stroke="${p.white}" stroke-width="2.3"/>
    `,
  },
  {
    name: 'entertainment',
    label: '休闲娱乐',
    body: `
      <circle cx="32" cy="32" r="24" fill="${p.red}"/>
      <path d="M17 15c6-5 15-6 22-3" stroke="${p.white}" stroke-width="2.6"/>
      <path d="m11 23 5 12h12l3-12Zm22 0 3 12h12l5-12Z" fill="${p.purple}"/>
      <path d="M30 27h4M12 23H9M53 23h2"/>
      <path d="m16 25 3 6h5l2-6Zm22 0 2 6h5l3-6Z" fill="${p.white}" stroke="none"/>
      <path d="M31 45c6 0 10-3 12-7" stroke="${p.white}" stroke-width="3.2"/>
    `,
  },
  {
    name: 'shopping',
    label: '购物',
    body: `
      <path d="M16 26h32a5 5 0 0 1 5 4l4 20a4 4 0 0 1-4 5H11a4 4 0 0 1-4-5l4-20a5 5 0 0 1 5-4Z" fill="${p.purple}"/>
      <path d="M21 30V18a11 11 0 0 1 22 0v12"/>
      <path d="M10 34c12 8 32 8 44 0"/>
      <rect x="28" y="38" width="8" height="7" rx="1.5" fill="${p.yellow}"/>
      <path d="m14 41-1.5 8M15 29h3" stroke="${p.white}" stroke-width="2.5"/>
    `,
  },
  {
    name: 'fashion-beauty',
    label: '穿搭美容',
    body: `
      <path d="m23 14-12 7-4 19 10 3 2-8v18a3 3 0 0 0 3 3h20a3 3 0 0 0 3-3V35l2 8 10-3-4-19-12-7Z" fill="${p.red}"/>
      <path d="M22 11h20a2 2 0 0 1 2 2c0 7-5 11-12 11s-12-4-12-11a2 2 0 0 1 2-2Z" fill="${p.orange}"/>
      <path d="M28 26v8M36 26v8"/>
      <path d="m16 24-3 12M23 39v11" stroke="${p.white}" stroke-width="2.5"/>
    `,
  },
  {
    name: 'fruit-snacks',
    label: '水果零食',
    body: `
      <path d="M19 19 17 9l11 7 4-10 5 10 10-7-2 12" fill="${p.green}"/>
      <path d="M13 31c0-11 8-15 19-15s19 4 19 15c0 12-12 26-19 26S13 43 13 31Z" fill="${p.red}"/>
      <path d="M19 27c1-4 5-6 10-6" stroke="${p.white}" stroke-width="2.5"/>
      <path d="M26 29v2M38 26v2M43 36v2M21 37v2M32 36v2M28 46v2M37 45v2" stroke-width="3"/>
    `,
  },
  {
    name: 'transport',
    label: '交通',
    body: `
      <path d="M17 47v8M47 47v8M8 28v8M56 28v8" stroke-width="4"/>
      <rect x="13" y="9" width="38" height="44" rx="7" fill="${p.blue}"/>
      <path d="M13 29V16a7 7 0 0 1 7-7h24a7 7 0 0 1 7 7v13Z" fill="${p.white}"/>
      <path d="M17 29V17a3 3 0 0 1 3-3h24a3 3 0 0 1 3 3v12Z" fill="${p.green}"/>
      <path d="m22 24 5 5M31 23l6 6"/>
      <circle cx="22" cy="41" r="3" fill="${p.yellow}"/>
      <circle cx="42" cy="41" r="3" fill="${p.yellow}"/>
      <path d="M17 36v11" stroke="${p.white}" stroke-width="2.3"/>
    `,
  },
  {
    name: 'daily-necessities',
    label: '生活日用',
    body: `
      <path d="M18 10h25c-7 0-10 8-10 17v25l-5-3-5 4-5-3-6 3V24c0-8 2-14 6-14Z" fill="${p.yellow}"/>
      <ellipse cx="43" cy="27" rx="11" ry="17" fill="${p.yellow}"/>
      <ellipse cx="44" cy="27" rx="5" ry="12" fill="${p.orange}"/>
      <path d="M17 43V25c0-5 1-8 3-10" stroke="${p.white}" stroke-width="2.5"/>
      <path d="M28 32v11"/>
    `,
  },
  {
    name: 'social',
    label: '人情社交',
    body: `
      <path d="M30 19c-9 0-15-3-15-8a5 5 0 0 1 9-3c3 3 6 11 6 11Zm4 0c9 0 15-3 15-8a5 5 0 0 0-9-3c-3 3-6 11-6 11Z" fill="${p.red}"/>
      <rect x="12" y="28" width="40" height="28" rx="3" fill="${p.red}"/>
      <rect x="8" y="19" width="48" height="13" rx="3" fill="${p.red}"/>
      <path d="M27 19h10v37H27Z" fill="${p.purple}"/>
      <path d="M12 23h11M16 37v14M30.5 23v28" stroke="${p.white}" stroke-width="2.3"/>
    `,
  },
  {
    name: 'pets',
    label: '宠物',
    body: `
      <path d="M12 32V12l13 8a26 26 0 0 1 14 0l13-8v20c3 15-7 24-20 24S9 47 12 32Z" fill="${p.red}"/>
      <path d="m16 25 .5-6 6 4M42 23l5.5-4 .5 6" fill="${p.purple}" stroke="none"/>
      <path d="M17 29c3-3 6-4 9-4" stroke="${p.white}" stroke-width="2.3"/>
      <ellipse cx="23" cy="33" rx="2.5" ry="3" fill="${p.ink}" stroke="none"/>
      <ellipse cx="41" cy="33" rx="2.5" ry="3" fill="${p.ink}" stroke="none"/>
      <path d="m28 40 4 4 4-4Z" fill="${p.yellow}"/>
      <path d="M32 44c-1 5-6 6-9 2M32 44c1 5 6 6 9 2M18 41 7 38M18 46 8 48M46 41l11-3M46 46l10 2"/>
    `,
  },
  {
    name: 'childcare',
    label: '养娃',
    body: `
      <path d="m35 30 9-9c-2-4-1-8 2-10a7 7 0 0 1 10 10c-2 3-6 4-10 2l-9 9Z" fill="${p.orange}"/>
      <ellipse cx="23" cy="42" rx="15" ry="16" transform="rotate(36 23 42)" fill="${p.red}"/>
      <ellipse cx="23" cy="42" rx="7" ry="8" transform="rotate(36 23 42)" fill="${p.yellow}"/>
      <rect x="32" y="13" width="8" height="37" rx="4" transform="rotate(-45 36 31.5)" fill="${p.purple}"/>
      <path d="m25 21 17 17M13 40c0-4 3-7 5-8" stroke="${p.white}" stroke-width="2.3"/>
    `,
  },
  {
    name: 'sports',
    label: '运动',
    body: `
      <circle cx="32" cy="32" r="24" fill="${p.orange}"/>
      <path d="M12 20c12 1 25 14 32 33M20 12c1 12 14 25 33 32" fill="${p.red}"/>
      <path d="m15 49 34-34M10 29c17 0 26-6 30-19M24 54c1-15 11-25 30-28"/>
      <path d="M16 20c3-5 8-7 12-8" stroke="${p.white}" stroke-width="2.7"/>
    `,
  },
  {
    name: 'utilities',
    label: '生活服务',
    body: `
      <path d="M32 7C26 17 12 28 12 38a20 20 0 0 0 40 0C52 28 38 17 32 7Z" fill="${p.blue}"/>
      <path d="M20 34c2-5 6-9 10-14" stroke="${p.white}" stroke-width="2.6"/>
      <path d="m33 25-11 15h8l-1 12 13-18h-9Z" fill="${p.yellow}"/>
    `,
  },
  {
    name: 'groceries',
    label: '买菜',
    body: `
      <path d="m32 19 2-10 4 5 5-6-2 13Z" fill="${p.green}"/>
      <path d="M30 18c3-3 9 0 10 3 3 7-19 27-30 33 3-13 15-31 20-36Z" fill="${p.red}"/>
      <path d="m44 31 6-9 1 6 6-3-5 11Z" fill="${p.green}"/>
      <path d="M41 31c3-3 10 0 11 4 2 5-14 20-22 23 1-10 7-23 11-27Z" fill="${p.red}"/>
      <path d="m26 27 5 3M19 37l5 3M40 40l6 2M36 49l4 2"/>
      <path d="m30 23-6 8M42 35l-3 5" stroke="${p.white}" stroke-width="2.3"/>
    `,
  },
  {
    name: 'housing',
    label: '住房',
    body: `
      <path d="M43 26h5l7 8v22H43Z" fill="${p.blue}"/>
      <path d="M20 17v-5a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v5Z" fill="${p.red}"/>
      <path d="M12 56V22a5 5 0 0 1 5-5h27a5 5 0 0 1 5 5v34Z" fill="${p.blue}"/>
      <path d="M25 56v-9a6 6 0 0 1 12 0v9Z" fill="${p.white}"/>
      <path d="M22 25v4M38 25v4M22 35v4M38 35v4" stroke-width="4"/>
      <path d="M16 26v25M25 13h14" stroke="${p.white}" stroke-width="2.3"/>
      <path d="M9 56h47"/>
    `,
  },
]
