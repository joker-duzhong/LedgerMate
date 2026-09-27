# 分类图标

根据用户提供的两张分类截图绘制，共 45 个 SVG：收入 17 个、支出 28 个。彩色填充、圆角深色描边；透明背景，不包含白色圆底或分类文字。

- 画布：64 × 64，描边：2.7；建议显示尺寸 32–64 px，SVG 可无损缩放。
- [打开全部图标预览](preview.html)，可切换显示尺寸和透明背景检查；离线直接打开即可。
- [manifest.json](manifest.json) 提供收支类型、中文分类名、文件名、相对路径和应用访问路径。
- 人情社交、其他等跨收支同名分类按目录区分，查找时同时使用 type 和 label。
- SVG 中的货币符号均由路径绘制，不依赖字体、外部图片或网络资源。

## 在项目中使用

源目录是 src/static/icons/categories，uni-app 访问路径是 /static/icons/categories。

```vue
<image src="/static/icons/categories/income/salary.svg" mode="aspectFit" style="width: 64rpx; height: 64rpx;" />
```

本批为独立素材。现有 AppIcon 的名称白名单与 categoryIcon 的映射尚未接入这套图标；直接使用上面的 image 路径即可显示。白色圆底由使用页面的容器样式提供。

## 重新生成

在仓库根目录执行：

```powershell
node scripts/generate-category-icons.cjs
```

图形源定义在 scripts/category-icons/ 的三个 CommonJS 文件中。请修改源定义后重新生成；脚本会更新这 45 个 SVG、manifest.json、README.md 和 preview.html，不修改其他图标集。全部文件使用 UTF-8。

## 收入（17 个）

| 分类 | SVG 文件 |
| --- | --- |
| 工资 | [income/salary.svg](income/salary.svg) |
| 兼职 | [income/part-time.svg](income/part-time.svg) |
| 投资理财 | [income/investment.svg](income/investment.svg) |
| 人情社交 | [income/social.svg](income/social.svg) |
| 奖金补贴 | [income/bonus.svg](income/bonus.svg) |
| 报销 | [income/reimbursement.svg](income/reimbursement.svg) |
| 生意 | [income/business.svg](income/business.svg) |
| 卖二手 | [income/second-hand.svg](income/second-hand.svg) |
| 生活费 | [income/allowance.svg](income/allowance.svg) |
| 中奖 | [income/lottery.svg](income/lottery.svg) |
| 收红包 | [income/red-packet.svg](income/red-packet.svg) |
| 收转账 | [income/transfer.svg](income/transfer.svg) |
| 保险理赔 | [income/insurance-claim.svg](income/insurance-claim.svg) |
| 退款 | [income/refund.svg](income/refund.svg) |
| 其他 | [income/other.svg](income/other.svg) |
| 返现 | [income/cashback.svg](income/cashback.svg) |
| AA | [income/split-bill.svg](income/split-bill.svg) |

## 支出（28 个）

| 分类 | SVG 文件 |
| --- | --- |
| 餐饮 | [expense/food.svg](expense/food.svg) |
| 休闲娱乐 | [expense/entertainment.svg](expense/entertainment.svg) |
| 购物 | [expense/shopping.svg](expense/shopping.svg) |
| 穿搭美容 | [expense/fashion-beauty.svg](expense/fashion-beauty.svg) |
| 水果零食 | [expense/fruit-snacks.svg](expense/fruit-snacks.svg) |
| 交通 | [expense/transport.svg](expense/transport.svg) |
| 生活日用 | [expense/daily-necessities.svg](expense/daily-necessities.svg) |
| 人情社交 | [expense/social.svg](expense/social.svg) |
| 宠物 | [expense/pets.svg](expense/pets.svg) |
| 养娃 | [expense/childcare.svg](expense/childcare.svg) |
| 运动 | [expense/sports.svg](expense/sports.svg) |
| 生活服务 | [expense/utilities.svg](expense/utilities.svg) |
| 买菜 | [expense/groceries.svg](expense/groceries.svg) |
| 住房 | [expense/housing.svg](expense/housing.svg) |
| 爱车 | [expense/car.svg](expense/car.svg) |
| 发红包 | [expense/red-packet.svg](expense/red-packet.svg) |
| 转账 | [expense/transfer.svg](expense/transfer.svg) |
| 学习教育 | [expense/education.svg](expense/education.svg) |
| 网络虚拟 | [expense/gaming.svg](expense/gaming.svg) |
| 烟酒 | [expense/tobacco-alcohol.svg](expense/tobacco-alcohol.svg) |
| 医疗保健 | [expense/healthcare.svg](expense/healthcare.svg) |
| 金融保险 | [expense/finance-insurance.svg](expense/finance-insurance.svg) |
| 家居家电 | [expense/home-appliances.svg](expense/home-appliances.svg) |
| 酒店旅行 | [expense/travel.svg](expense/travel.svg) |
| 公益 | [expense/charity.svg](expense/charity.svg) |
| 互助保障 | [expense/mutual-aid.svg](expense/mutual-aid.svg) |
| 其他 | [expense/other.svg](expense/other.svg) |
| 还款 | [expense/repayment.svg](expense/repayment.svg) |
