<script setup lang="ts">
// 特殊能力の札。タップすると、その能力の中身（序列・対象・効果・上位/下位）を出す
import { computed, ref } from 'vue'
import { getSkill, tierClass } from '@/game/skills'

const props = withDefaults(defineProps<{ ids: string[]; emptyText?: string; small?: boolean }>(), { emptyText: '', small: false })

const list = computed(() => props.ids.map((id) => getSkill(id)).filter((x): x is NonNullable<typeof x> => !!x))
const open = ref<string | null>(null)
const cur = computed(() => (open.value ? getSkill(open.value) : undefined))
const TARGET = { batter: '野手', pitcher: '投手', all: '野手・投手' } as const
const POS = { C: '捕手のみ', IF: '内野手のみ', OF: '外野手のみ' } as const
function rankLabel(id: string): string {
  const s = getSkill(id)
  if (!s) return ''
  return s.good ? `序列${s.tier}` : `弱点（痛さ${s.tier}）`
}
</script>

<template>
  <span class="chips">
    <button
      v-for="s in list"
      :key="s.id"
      type="button"
      class="chip"
      :class="[s.good ? 'good' : 'bad', tierClass(s.id), { small }]"
      @click.stop="open = s.id"
    >
      {{ s.name }}
    </button>
    <span v-if="list.length === 0 && emptyText" class="muted">{{ emptyText }}</span>
  </span>
  <Teleport to="body">
    <div v-if="cur" class="sk-backdrop" @click="open = null">
      <div class="sk-card card" @click.stop>
        <div class="sk-head">
          <span class="chip" :class="[cur.good ? 'good' : 'bad', tierClass(cur.id)]">{{ cur.name }}</span>
          <span class="sk-rank">{{ rankLabel(cur.id) }}</span>
        </div>
        <p class="sk-desc">{{ cur.description }}</p>
        <p class="sk-meta">
          対象：{{ TARGET[cur.target] }}<template v-if="cur.pos">（{{ POS[cur.pos] }}）</template>
          <template v-if="cur.upper && getSkill(cur.upper)"><br />上位：{{ getSkill(cur.upper)!.name }}</template>
          <template v-if="cur.lower && getSkill(cur.lower)"><br />下位：{{ getSkill(cur.lower)!.name }}（取ると置き換わる）</template>
        </p>
        <button class="secondary full" @click="open = null">閉じる</button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.chips {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}
.chip {
  border: 1px solid #b9d7a8;
  background: #eaf6e2;
  color: #2f5a1e;
  border-radius: 999px;
  padding: 3px 9px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.4;
  cursor: pointer;
}
.chip.small {
  font-size: 11px;
  padding: 2px 7px;
}
.chip.bad {
  border-color: #e8b0b0;
  background: #fdecec;
  color: #9b2b2b;
}
.sk-backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
  background: rgba(5, 12, 24, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.sk-card {
  color: var(--ink);
  width: min(360px, 100%);
  padding: 16px;
}
.sk-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.sk-head .chip {
  font-size: 15px;
  cursor: default;
}
.sk-rank {
  font-size: 12px;
  color: #666;
  font-weight: 700;
}
.sk-desc {
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 1.6;
}
.sk-meta {
  margin: 0 0 12px;
  font-size: 12px;
  color: #555;
  line-height: 1.6;
}
</style>
