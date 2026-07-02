import { defineComponent, reactive, ref, computed } from 'vue';
import TerminalTab from './TerminalTab';

interface TabData {
  id: number;
  title: string;
  type: 'home' | 'terminal';
}

let nextTabId = 1;

export default defineComponent({
  components: { TerminalTab },
  setup() {
    const tabs = reactive<TabData[]>([
      { id: 0, title: '主页', type: 'home' },
    ]);
    const activeId = ref(0);

    const terminalTabs = computed(() =>
      tabs.filter((t) => t.type === 'terminal')
    );

    function addTerminalTab(): void {
      const id = nextTabId++;
      tabs.push({ id, title: `终端 ${id}`, type: 'terminal' });
      activeId.value = id;
    }

    function closeTab(id: number): void {
      if (id === 0) return; // 主页不可关闭
      const idx = tabs.findIndex((t) => t.id === id);
      if (idx === -1) return;
      tabs.splice(idx, 1);
      if (activeId.value === id) {
        // 切到前一个或后一个标签页
        activeId.value = tabs[Math.min(idx, tabs.length - 1)].id;
      }
    }

    function switchTab(id: number): void {
      activeId.value = id;
    }

    return {
      tabs,
      activeId,
      terminalTabs,
      addTerminalTab,
      closeTab,
      switchTab,
    };
  },
  template: `
    <div class="app-layout">
      <!-- 标签栏 -->
      <div class="tab-bar">
        <div class="tabs-scroll">
          <div
            v-for="tab in tabs"
            :key="tab.id"
            class="tab"
            :class="{ active: tab.id === activeId }"
            @click="switchTab(tab.id)"
            @mousedown.middle="closeTab(tab.id)"
          >
            <span class="tab-label">{{ tab.title }}</span>
            <span
              v-if="tab.type === 'terminal'"
              class="tab-close"
              @click.stop="closeTab(tab.id)"
              title="关闭"
            >&times;</span>
          </div>
        </div>
        <div class="tab-add" @click="addTerminalTab" title="新标签页">+</div>
      </div>

      <!-- 内容区 -->
      <div class="content-area">
        <!-- 主页 -->
        <div v-show="activeId === 0" class="page-home">
          <div class="quick-actions">
            <button>新建实例</button>
            <button>打开文件夹…</button>
            <button>设置</button>
            <button>帮助</button>
          </div>
          <div class="home-body">
            <div class="instance-list">
              <!-- 实例列表（暂无内容） -->
            </div>
            <div class="function-menu">
              <!-- 功能菜单（暂无内容） -->
            </div>
          </div>
        </div>

        <!-- 终端标签页 -->
        <div
          v-for="tab in terminalTabs"
          v-show="tab.id === activeId"
          :key="tab.id"
          class="terminal-wrapper"
        >
          <TerminalTab :tab-id="tab.id" :is-active="tab.id === activeId" />
        </div>
      </div>
    </div>
  `,
});
