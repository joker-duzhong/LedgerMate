<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'

onLaunch(() => {
  const auth = useAuthStore()
  auth.clear()
})
</script>

<style lang="scss">
@import '@/styles/theme.scss';
page { background: $canvas; color: $ink; font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", sans-serif; font-size: 28rpx; line-height: 1.5; }
view, button, input, textarea { box-sizing: border-box; }
button { font-family: inherit; }
button::after { border: none; }
input, textarea { color: $ink; }
input::placeholder, textarea::placeholder { color: $muted; }
button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid $brand; outline-offset: 3px; }
@media (prefers-reduced-motion: reduce) { view, button { animation: none !important; transition: none !important; } }
</style>
