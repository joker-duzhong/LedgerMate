const tabs = [
  { pagePath: '/pages/home/index', text: '明细', icon: 'ledger' },
  { pagePath: '/pages/assets/index', text: '资产', icon: 'wallet' },
  { pagePath: '/pages/statistics/index', text: '统计', icon: 'chart' },
  { pagePath: '/pages/manage/index', text: '我的', icon: 'settings' }
]
Component({
  data: { selected: 0, hidden: false, overlayHidden: false, switching: false, loggedIn: false, tabs },
  lifetimes: { attached() { this.sync() } },
  pageLifetimes: { show() { this.sync() } },
  methods: {
    sync() {
      const pages = getCurrentPages()
      const route = '/' + (pages[pages.length - 1]?.route || '')
      const selected = tabs.findIndex(item => item.pagePath === route)
      this.setData({ selected: selected >= 0 ? selected : this.data.selected, hidden: selected < 0 || this.data.overlayHidden, switching: false })
    },
    openChat() {
      if (this.data.switching) return
      this.setData({ switching: true })
      wx.navigateTo({ url: this.data.loggedIn ? '/pages/ai-chat/index' : '/pages/login/index', complete: () => this.setData({ switching: false }) })
    },
    switchTab(event) {
      const index = Number(event.currentTarget.dataset.index)
      if (this.data.switching || index === this.data.selected || !tabs[index]) return
      this.setData({ switching: true })
      wx.switchTab({
        url: tabs[index].pagePath,
        success: () => this.setData({ selected: index, hidden: this.data.overlayHidden }),
        complete: () => this.setData({ switching: false })
      })
    }
  }
})
