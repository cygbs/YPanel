<!-- 本源代码文件是YPanel项目的一部分，版权所有 (C) cygbs 2026。本项目遵循AGPL-3.0-or-later许可证。 -->
<template>
  <div v-if="showUploadDialog" class="dialog-overlay" @click.self="cancelUpload">
    <div class="dialog">
      <div class="dialog-title">{{ $t('upload.title') }}</div>
      <div class="dialog-body">
        <template v-if="!uploadFile">
          <div class="upload-dropzone" @click="triggerFileInput" @dragover.prevent @drop.prevent="onFileDrop">
            <div class="upload-hint">{{ $t('upload.dropzone_hint') }}</div>
          </div>
          <input ref="fileInputRef" type="file" class="upload-input-hidden" @change="onFileSelected" />
        </template>
        <template v-else>
          <label class="field">
            <span class="field-label">{{ $t('upload.file') }}</span>
            <input type="text" class="input mono" :value="uploadFile.name" readonly />
          </label>
          <label class="field">
            <span class="field-label">{{ $t('upload.size') }}</span>
            <input type="text" class="input" :value="formatSize(uploadFile.size)" readonly />
          </label>
          <label class="field">
            <span class="field-label">{{ $t('upload.path_hint') }}</span>
            <input v-model="uploadPath" type="text" class="input mono"
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
      </div>
      <div class="dialog-actions">
        <template v-if="!uploadFile">
          <button class="btn btn-secondary" @click="cancelUpload">{{ $t('upload.close') }}</button>
        </template>
        <template v-else-if="uploadStatus === 'idle' || uploadStatus === 'error'">
          <button class="btn btn-secondary" @click="cancelUpload">{{ $t('upload.cancel') }}</button>
          <button class="btn btn-primary" @click="startUpload">{{ $t('upload.upload') }}</button>
        </template>
        <template v-else-if="uploadStatus === 'complete'">
          <button class="btn btn-primary" @click="cancelUpload">{{ $t('upload.done') }}</button>
        </template>
      </div>
    </div>
  </div>
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
