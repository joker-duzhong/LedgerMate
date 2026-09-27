module.exports = (p) => [
  {
    name: 'car',
    label: '爱车',
    body: `<path d="M14 29 18 14a5 5 0 0 1 5-4h18a5 5 0 0 1 5 4l4 15 3 3a7 7 0 0 1 2 5v10a3 3 0 0 1-3 3h-3v3a3 3 0 0 1-6 0v-3H21v3a3 3 0 0 1-6 0v-3h-3a3 3 0 0 1-3-3V37a7 7 0 0 1 2-5Z" fill="${p.blue}"/>
      <path d="m21 18-3 12h28l-3-12Z" fill="${p.yellow}"/>
      <path d="m14 28 4-14a3 3 0 0 1 3-2" stroke="${p.white}" stroke-width="2.5"/>
      <circle cx="19" cy="39" r="3" fill="${p.white}"/>
      <circle cx="45" cy="39" r="3" fill="${p.white}"/>
      <path d="M28 46h8"/>
      <path d="M23 20h7" stroke="${p.white}" stroke-width="2.3"/>`,
  },
  {
    name: 'red-packet',
    label: '发红包',
    body: `<rect x="13" y="8" width="38" height="48" rx="9" fill="${p.red}"/>
      <path d="M18 44V19a6 6 0 0 1 6-6h16" stroke="${p.white}" stroke-width="2.5"/>
      <path d="M23 17q9 11 18 0"/>
      <path d="m26 28 6 7 6-7M25 36h14M25 41h14M32 35v13"/>`,
  },
  {
    name: 'transfer',
    label: '转账',
    body: `<rect x="12" y="8" width="31" height="48" rx="5" fill="${p.blue}"/>
      <path d="M12 49h31"/>
      <path d="M18 43V15a2 2 0 0 1 2-2h12" stroke="${p.white}" stroke-width="2.5"/>
      <rect x="27" y="20" width="28" height="25" rx="3" fill="${p.green}"/>
      <path d="M27 27h28"/>
      <path d="M35 36h12m-4-4 4 4-4 4"/>
      <path d="M31 23h6" stroke="${p.white}" stroke-width="2"/>`,
  },
  {
    name: 'education',
    label: '学习教育',
    body: `<path d="M17 28v19c0 5 7 8 15 8s15-3 15-8V28Z" fill="${p.blue}"/>
      <path d="M22 36v10c0 2 2 3 5 4" stroke="${p.white}" stroke-width="2.5"/>
      <path d="m8 24 24-13 24 13-24 13Z" fill="${p.green}"/>
      <path d="m15 24 17-9 9 5" stroke="${p.white}" stroke-width="2.5"/>
      <path d="M56 25v20"/>
      <path d="M35 47q4 0 7-2"/>`,
  },
  {
    name: 'gaming',
    label: '网络虚拟',
    body: `<path d="M32 21c0-6 14-3 13-9S24 13 19 8"/>
      <path d="M20 21h24c9 0 12 9 12 17 0 7-3 11-8 11-6 0-7-8-13-8h-6c-6 0-7 8-13 8-5 0-8-4-8-11 0-8 3-17 12-17Z" fill="${p.purple}"/>
      <path d="M13 34c1-5 3-8 7-8h8" stroke="${p.white}" stroke-width="2.5"/>
      <path d="M19 29v12M13 35h12" stroke="${p.ink}" stroke-width="6"/>
      <path d="M19 30v10M14 35h10" stroke="${p.white}" stroke-width="2.4"/>
      <circle cx="46" cy="30" r="3" fill="${p.orange}"/>
      <circle cx="40" cy="38" r="3" fill="${p.yellow}"/>`,
  },
  {
    name: 'tobacco-alcohol',
    label: '烟酒',
    body: `<path d="M9 13h24v11c0 9-4 14-12 14S9 33 9 24Z" fill="${p.purple}"/>
      <path d="M9 13h24v10c-8 4-16-4-24 0Z" fill="${p.orange}"/>
      <path d="M13 16h14" stroke="${p.white}" stroke-width="2.3"/>
      <path d="M21 38v15M14 53h14"/>
      <path d="M14 28q0 4 4 5" stroke="${p.white}" stroke-width="2.3"/>
      <path d="M40 34V24h5v10m0 0V21h5v13m0 0V27h5v7" fill="${p.white}"/>
      <path d="M38 34h18v20H38Z" fill="${p.yellow}"/>
      <path d="M38 40h18"/>`,
  },
  {
    name: 'healthcare',
    label: '医疗保健',
    body: `<path d="M21 27h-9a4 4 0 0 0-4 4v24h14m20-28h10a4 4 0 0 1 4 4v24H42" fill="${p.blue}"/>
      <path d="M22 55V13a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v42Z" fill="${p.green}"/>
      <path d="M26 36V15h7" stroke="${p.white}" stroke-width="2.4"/>
      <path d="M27 23h10M32 18v10"/>
      <path d="M29 55V42h7v13" fill="${p.white}"/>
      <path d="M12 34v17" stroke="${p.white}" stroke-width="2.4"/>
      <path d="M47 35v5m0 6v5"/>`,
  },
  {
    name: 'finance-insurance',
    label: '金融保险',
    body: `<path d="m8 30 24-21 11 10v-8h9v16l5 4-5 7-4-3v20H17V35l-4 3Z" fill="${p.blue}"/>
      <path d="m14 29 18-16 7 6M21 36v14" stroke="${p.white}" stroke-width="2.5"/>
      <rect x="25" y="29" width="18" height="20" rx="7" fill="${p.yellow}"/>
      <path d="m30 33 4 5 4-5M29 39h10M30 43h8M34 38v8" stroke-width="2.2"/>`,
  },
  {
    name: 'home-appliances',
    label: '家居家电',
    body: `<path d="m24 8 8 8 9-8"/>
      <rect x="8" y="16" width="48" height="36" rx="5" fill="${p.blue}"/>
      <path d="M13 45V23a2 2 0 0 1 2-2h29" stroke="${p.white}" stroke-width="2.5"/>
      <rect x="17" y="25" width="26" height="20" rx="2" fill="${p.orange}"/>
      <path d="M21 40V29h8" stroke="${p.yellow}" stroke-width="2.4"/>
      <path d="M48 25h2m-2 7h2M17 52v4m30-4v4"/>`,
  },
  {
    name: 'travel',
    label: '酒店旅行',
    body: `<circle cx="25" cy="22" r="15" fill="${p.yellow}"/>
      <path d="M15 21a10 10 0 0 1 10-10" stroke="${p.white}" stroke-width="2.5"/>
      <path d="M9 55 25 24l15 31Z" fill="${p.red}"/>
      <path d="m20 34 5-10 5 10-5-3Z" fill="${p.white}"/>
      <path d="m20 55 14-35 11 35Z" fill="${p.blue}"/>
      <path d="m29 34 5-14 5 14-5-4Z" fill="${p.white}"/>
      <path d="m31 55 14-27 13 27Z" fill="${p.purple}"/>
      <path d="m46 16 4 2 3-2 4 2" stroke-width="2.3"/>`,
  },
  {
    name: 'charity',
    label: '公益',
    body: `<path d="M32 55S8 41 8 24c0-13 15-18 24-7 9-11 24-6 24 7 0 17-24 31-24 31Z" fill="${p.red}"/>
      <path d="M13 26c-1-8 8-14 14-8" stroke="${p.white}" stroke-width="2.5"/>
      <path d="M32 26v18M23 35h18" stroke="${p.ink}" stroke-width="5"/>
      <path d="M32 27v16M24 35h16" stroke="${p.white}" stroke-width="2.2"/>`,
  },
  {
    name: 'mutual-aid',
    label: '互助保障',
    body: `<path d="M32 55S8 41 8 24c0-13 15-18 24-7 9-11 24-6 24 7 0 17-24 31-24 31Z" fill="${p.red}"/>
      <path d="M13 26c-1-8 8-14 14-8" stroke="${p.white}" stroke-width="2.5"/>
      <path d="M6 34h11l6-9 9 18 6-11h20" stroke="${p.white}" stroke-width="6"/>
      <path d="M6 34h11l6-9 9 18 6-11h20"/>`,
  },
  {
    name: 'other',
    label: '其他',
    body: `<circle cx="32" cy="32" r="24" fill="${p.orange}"/>
      <path d="M15 39a19 19 0 0 1 24-24" stroke="${p.white}" stroke-width="2.5"/>
      <path d="m24 20 8 10 8-10M23 32h18M23 38h18M32 30v16"/>`,
  },
  {
    name: 'repayment',
    label: '还款',
    body: `<path d="M15 22h34a6 6 0 0 1 6 6v23a4 4 0 0 1-4 4H13a4 4 0 0 1-4-4V28a6 6 0 0 1 6-6Z" fill="${p.yellow}"/>
      <rect x="17" y="8" width="30" height="38" rx="3" fill="${p.yellow}"/>
      <path d="M22 36V13h11" stroke="${p.white}" stroke-width="2.5"/>
      <path d="m26 17 6 7 6-7M25 25h14M25 30h14M32 24v12"/>
      <path d="M9 42h46v9a4 4 0 0 1-4 4H13a4 4 0 0 1-4-4Z" fill="${p.red}"/>
      <path d="M14 48h19" stroke="${p.white}" stroke-width="2.5"/>`,
  },
]
