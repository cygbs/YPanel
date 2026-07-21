<!-- 本源代码文件是YPanel项目的一部分，版权所有 (C) cygbs 2026。本项目遵循AGPL-3.0-or-later许可证。 -->
<template>
  <el-dialog v-model="showUploadDialog" :title="$t('upload.title')" width="500px"
    :close-on-click-modal="true" @closed="cancelUpload">
    <template v-if="!uploadFile">
      <div class="upload-dropzone" @click="triggerFileInput" @dragover.prevent @drop.prevent="onFileDrop">
        <div class="upload-hint">{{ $t('upload.dropzone_hint') }}</div>
      </div>
      <input ref="fileInputRef" type="file" class="upload-input-hidden" @change="onFileSelected" />
    </template>
    <template v-else>
      <label class="field">
        <span class="field-label">{{ $t('upload.file') }}</span>
        <el-input :model-value="uploadFile.name" readonly class="mono-input" />
      </label>
      <label class="field">
        <span class="field-label">{{ $t('upload.size') }}</span>
        <el-input :model-value="formatSize(uploadFile.size)" readonly />
      </label>
      <label class="field">
        <span class="field-label">{{ $t('upload.path_hint') }}</span>
        <el-input v-model="uploadPath" class="mono-input"
          :placeholder="$t('upload.path_placeholder')" />
      </label>
      <div v-if="uploadStatus" class="upload-status-area">
        <div class="upload-progress-bar">
          <div class="upload-progress-fill" :style="{ width: uploadProgress + '%' }"></div>
        </div>
        <div class="upload-progress-text">
          <template v-if="uploadStatus === 'uploading'">
            {{ $t('upload.uploading', { received: formatSize(uploadReceived), total: formatSize(uploadTotal) }) }}
          </template>
          <template v-else-if="uploadStatus === 'complete'">{{ $t('upload.complete') }}</template>
          <template v-else-if="uploadStatus === 'error'">{{ uploadError }}</template>
        </div>
      </div>
    </template>
    <template #footer>
      <template v-if="!uploadFile">
        <el-button @click="cancelUpload">{{ $t('upload.close') }}</el-button>
      </template>
      <template v-else-if="uploadStatus === 'idle' || uploadStatus === 'error'">
        <el-button @click="cancelUpload">{{ $t('upload.cancel') }}</el-button>
        <el-button type="primary" @click="startUpload">{{ $t('upload.upload') }}</el-button>
      </template>
      <template v-else-if="uploadStatus === 'complete'">
        <el-button type="primary" @click="cancelUpload">{{ $t('upload.done') }}</el-button>
      </template>
    </template>
  </el-dialog>
</template>

<script lang="ts">
import { defineComponent, inject, ref, type Ref } from 'vue';

export default defineComponent({
  setup() {
    const fileInputRef = ref<HTMLInputElement | null>(null);
    return {
      showUploadDialog: inject<Ref<boolean>>('showUploadDialog')!,
      uploadFile: inject<Ref<File | null>>('uploadFile')!,
      uploadPath: inject<Ref<string>>('uploadPath')!,
      uploadStatus: inject<Ref<string>>('uploadStatus')!,
      uploadProgress: inject<Ref<number>>('uploadProgress')!,
      uploadReceived: inject<Ref<number>>('uploadReceived')!,
      uploadTotal: inject<Ref<number>>('uploadTotal')!,
      uploadError: inject<Ref<string>>('uploadError')!,
      fileInputRef,
      cancelUpload: inject('cancelUpload')!,
      startUpload: inject('startUpload')!,
      triggerFileInput: inject('triggerFileInput')!,
      onFileSelected: inject('onFileSelected')!,
      onFileDrop: inject('onFileDrop')!,
      formatSize: inject<(bytes: number) => string>('formatSize')!,
    };
  },
});
</script>
