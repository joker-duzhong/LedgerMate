<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
import type { Category, RecordType } from '@/types/api'
import { categoryIcon, categoryIconSource } from '@/utils/icons'

const props = withDefaults(defineProps<{
  category?: Partial<Category> | null
  name?: string
  recordType?: RecordType
  size?: number
  color?: string
}>(), { name: '', size: 40, color: 'color' })

const failed = ref(false)
const source = computed(() => categoryIconSource(props.category?.icon))
const displayName = computed(() => props.name || props.category?.name || '')
const fallback = computed(() => categoryIcon(displayName.value))
watch(source, () => { failed.value = false })
</script>

<template>
  <image v-if="source && !failed" class="category-icon-image" :src="source" :style="{ width: size + 'rpx', height: size + 'rpx' }" mode="aspectFit" aria-hidden="true" @error="failed = true" />
  <AppIcon v-else :name="fallback" :size="size" :color="color" />
</template>

<style scoped>
.category-icon-image { display: inline-block; flex-shrink: 0; vertical-align: middle; }
</style>
