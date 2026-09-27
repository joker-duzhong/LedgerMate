module.exports = (p) => [
  {
    name: 'salary',
    label: '工资',
    body: `<path d="M12 22V16a6 6 0 0 1 6-6h26a6 6 0 0 1 6 6v8" fill="${p.white}"/>
      <path d="M17 16h26"/>
      <rect x="10" y="19" width="46" height="35" rx="7" fill="${p.red}"/>
      <path d="M11 26h43"/>
      <path d="M43 32h13v13H43a6.5 6.5 0 0 1 0-13Z" fill="${p.purple}"/>
      <circle cx="43" cy="38.5" r="1.7" fill="${p.white}" stroke="none"/>
      <path d="M17 34v12" stroke="${p.white}"/>`,
  },
  {
    name: 'part-time',
    label: '兼职',
    body: `<path d="M36 10h6a4 4 0 0 1 4 4v15"/>
      <path d="M46 18h7v8h-7" fill="${p.yellow}"/>
      <rect x="8" y="21" width="22" height="23" rx="4" fill="${p.red}"/>
      <path d="M9 32h20"/>
      <path d="M12 34h13v6a5 5 0 0 0 10 0V26h10l5 19h4v7H10V41a7 7 0 0 1 2-7Z" fill="${p.blue}"/>
      <path d="M35 27h9"/>
      <circle cx="19" cy="51" r="7" fill="${p.green}"/>
      <circle cx="50" cy="51" r="7" fill="${p.green}"/>
      <path d="M14 25h11" stroke="${p.white}"/>`,
  },
  {
    name: 'investment',
    label: '投资理财',
    body: `<path d="M9 52V32h6v20" fill="${p.red}"/>
      <path d="M23 52V20h6v32" fill="${p.purple}"/>
      <path d="M37 52V29h6v23" fill="${p.blue}"/>
      <path d="M51 52V9h6v43" fill="${p.orange}"/>
      <path d="M7 57h51"/>
      <path d="M11 35v13M25 23v25M39 32v16M53 12v36" stroke="${p.white}" stroke-width="1.2"/>`,
  },
  {
    name: 'social',
    label: '人情社交',
    body: `<rect x="11" y="8" width="40" height="48" rx="9" fill="${p.white}"/>
      <path d="M22 13h20a5 5 0 0 1 5 5v38H22a6 6 0 0 1-6-6V19a6 6 0 0 1 6-6Z" fill="${p.red}"/>
      <path d="m26 23 5 7 5-7m-5 7v13m-7-11h14m-14 5h14"/>
      <circle cx="49" cy="48" r="10" fill="${p.yellow}"/>
      <path d="M49 43v10m-5-5h10"/>
      <path d="M23 18h16" stroke="${p.white}"/>`,
  },
  {
    name: 'bonus',
    label: '奖金补贴',
    body: `<path d="M18 16H8v12l13 9m25-21h10v12l-13 9" fill="${p.red}"/>
      <path d="M29 41v9h6v-9" fill="${p.blue}"/>
      <path d="M18 9h28v20a14 14 0 0 1-28 0Z" fill="${p.yellow}"/>
      <path d="m32 17 2.6 5.1 5.6.8-4.1 4 .9 5.6-5-2.7-5 2.7.9-5.6-4.1-4 5.6-.8Z" fill="${p.orange}" stroke-width="2.2"/>
      <path d="M23 12v17" stroke="${p.white}"/>
      <rect x="19" y="50" width="26" height="7" rx="2.5" fill="${p.red}"/>`,
  },
  {
    name: 'reimbursement',
    label: '报销',
    body: `<path d="m32 7 8 7 10 1 1 10 6 7-6 8-1 10-10 1-8 6-8-6-10-1-1-10-6-8 6-7 1-10 10-1Z" fill="${p.green}"/>
      <path d="m32 14 6 5 7 .5.5 7 4.5 5.5-4.5 6-.5 7-7 .5-6 4.5-6-4.5-7-.5-.5-7-4.5-6 4.5-5.5.5-7 7-.5Z" stroke="${p.white}" stroke-width="2"/>
      <rect x="12" y="24" width="40" height="17" rx="3" fill="${p.white}"/>
      <path d="m18 32 4 4 7-8" stroke="${p.green}" stroke-width="3.5"/>
      <path d="M35 30h10m-10 6h7" stroke-width="2.2"/>`,
  },
  {
    name: 'business',
    label: '生意',
    body: `<rect x="14" y="25" width="36" height="31" rx="2" fill="${p.yellow}"/>
      <path d="m10 24 4-12h36l4 12a7 7 0 0 1-13 3 10 10 0 0 1-18 0 7 7 0 0 1-13-3Z" fill="${p.red}"/>
      <path d="M18 16h28" stroke="${p.white}"/>
      <path d="M20 34v16h25" stroke="${p.white}" stroke-width="3"/>
      <path d="M43 43H26m0 0 5-5m-5 5 5 5"/>`,
  },
  {
    name: 'second-hand',
    label: '卖二手',
    body: `<path d="M34 22h18l4 31a3 3 0 0 1-3 3H34Z" fill="${p.purple}"/>
      <path d="M34 28V16a7 7 0 0 1 14 0v10"/>
      <path d="M15 22h27l3 34H11a3 3 0 0 1-3-3l4-28a3 3 0 0 1 3-3Z" fill="${p.red}"/>
      <path d="M21 27V16a7 7 0 0 1 14 0v11"/>
      <path d="m21 39 6 6 10-12" stroke="${p.white}" stroke-width="3.7"/>
      <path d="m15 30-2 19" stroke="${p.white}" stroke-width="2"/>`,
  },
  {
    name: 'allowance',
    label: '生活费',
    body: `<path d="m7 29 22-20a4 4 0 0 1 6 0l7 6v-6h9v14l7 6-6 7-3-3v20a3 3 0 0 1-3 3H19a3 3 0 0 1-3-3V33l-3 3Z" fill="${p.blue}"/>
      <path d="m14 28 17-16" stroke="${p.white}" stroke-width="2.5"/>
      <rect x="23" y="30" width="20" height="21" rx="8" fill="${p.yellow}"/>
      <path d="m29 34 4 5 4-5m-4 5v8m-6-7h12m-12 4h12" stroke-width="2.2"/>`,
  },
  {
    name: 'lottery',
    label: '中奖',
    body: `<path d="m9 24 7-14h32l7 14v29a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3Z" fill="${p.red}"/>
      <path d="M10 24h44M16 11l-3 12m35-12 3 12"/>
      <path d="M27 10h10v28l-5-4-5 4Z" fill="${p.yellow}"/>
      <path d="M27 24h10"/>
      <path d="M15 30v18m28 2h6" stroke="${p.white}"/>
      <path d="M20 16h3m17 0h4" stroke="${p.white}" stroke-width="2"/>`,
  },
  {
    name: 'red-packet',
    label: '收红包',
    body: `<rect x="12" y="8" width="40" height="49" rx="10" fill="${p.red}"/>
      <path d="M18 47V19a5 5 0 0 1 5-5h19" stroke="${p.white}"/>
      <path d="M23 18q9 10 18 0"/>
      <path d="m25 30 7 8 7-8m-7 8v13m-9-12h18m-18 6h18"/>
      <path d="m26 28 6 7 6-7" stroke="${p.white}" stroke-width="1.8"/>`,
  },
  {
    name: 'transfer',
    label: '收转账',
    body: `<path d="M13 17h25l-6-8h10l12 17H13a4.5 4.5 0 0 1 0-9Z" fill="${p.orange}"/>
      <path d="M51 45H26l6 8H22L10 36h41a4.5 4.5 0 0 1 0 9Z" fill="${p.green}"/>
      <path d="M14 20h25m11 19H24" stroke="${p.white}" stroke-width="2.3"/>`,
  },
  {
    name: 'insurance-claim',
    label: '保险理赔',
    body: `<path d="M32 7v4"/>
      <path d="M32 35v16a7 7 0 0 1-14 0v-2"/>
      <path d="M9 36a23 25 0 0 1 46 0Z" fill="${p.green}"/>
      <path d="M32 11C22 17 20 26 20 36h24c0-10-2-19-12-25Z" fill="${p.white}"/>
      <path d="M32 11v25"/>
      <path d="M16 29a22 22 0 0 1 7-11" stroke="${p.white}" stroke-width="2.4"/>`,
  },
  {
    name: 'refund',
    label: '退款',
    body: `<circle cx="32" cy="32" r="24" fill="${p.yellow}"/>
      <path d="M15 29a17 17 0 0 1 24-13" stroke="${p.white}" stroke-width="3"/>
      <path d="M26 21v10h10"/>
      <path d="M26 30a11 11 0 1 1-1 15"/>
      <path d="M31 38h8" stroke-width="2.2"/>`,
  },
  {
    name: 'other',
    label: '其他',
    body: `<circle cx="32" cy="32" r="24" fill="${p.orange}"/>
      <path d="M15 30a17 17 0 0 1 24-14" stroke="${p.white}" stroke-width="3"/>
      <path d="m23 21 9 11 9-11m-9 11v16m-11-14h22m-22 7h22"/>`,
  },
  {
    name: 'cashback',
    label: '返现',
    body: `<circle cx="32" cy="32" r="24" fill="${p.green}"/>
      <path d="M15 30a17 17 0 0 1 24-14" stroke="${p.white}" stroke-width="3"/>
      <path d="M22 26h13a9 9 0 0 1 0 18h-8"/>
      <path d="m27 21-6 5 6 5"/>
      <path d="M28 38h7" stroke="${p.white}" stroke-width="2.3"/>`,
  },
  {
    name: 'split-bill',
    label: 'AA',
    body: `<path d="M23 19v-5a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v5" fill="${p.orange}"/>
      <rect x="9" y="18" width="46" height="37" rx="5" fill="${p.blue}"/>
      <path d="M15 48V26a2 2 0 0 1 2-2h28" stroke="${p.white}"/>
      <path d="m26 29 6 8 6-8m-6 8v12m-9-11h18m-18 6h18"/>
      <path d="m27 28 5 6 5-6" stroke="${p.white}" stroke-width="1.8"/>`,
  },
]
