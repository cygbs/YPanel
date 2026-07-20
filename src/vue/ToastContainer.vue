<!-- 本源代码文件是YPanel项目的一部分，版权所有 (C) cygbs 2026。本项目遵循AGPL-3.0-or-later许可证。 -->
<template>
  <div class="toast-container">
    <div v-for="n in notifications" :key="n.id" class="toast" :class="'toast-' + n.type">
      <div class="toast-bar"></div>
      <button class="toast-close" @click="dismissNotification(n.id)">&times;</button>
      <div class="toast-body">{{ n.message }}</div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, inject } from 'vue';

export default defineComponent({
  setup() {
    return {
      notifications: inject<any[]>('notifications')!,
      dismissNotification: inject('dismissNotification')!,
    };
  },
});
</script>
