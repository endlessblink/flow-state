import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);padding:20px;max-width:500px',
  title: 'font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:12px',
  dropZone: 'border:2px dashed var(--border-secondary);border-radius:var(--radius-lg);padding:20px;text-align:center;cursor:pointer;transition:border-color 0.2s',
  dropZoneActive: 'border:2px dashed var(--brand-primary);border-radius:var(--radius-lg);padding:20px;text-align:center;cursor:pointer;background:rgba(78,205,196,0.05)',
  dropZoneDisabled: 'border:2px dashed var(--border-primary);border-radius:var(--radius-lg);padding:20px;text-align:center;opacity:0.5;cursor:not-allowed',
  dropIcon: 'font-size:20px;color:var(--text-tertiary);margin-bottom:4px',
  dropText: 'font-size:12px;color:var(--text-tertiary)',
  thumbnails: 'display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px',
  thumb: 'width:100%;aspect-ratio:1;background:var(--surface-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;cursor:pointer',
  thumbImg: 'width:100%;height:100%;object-fit:cover;border-radius:var(--radius-md)',
  thumbDelete: 'position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,0.7);color:white;border:none;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center',
  thumbFallback: 'font-size:24px;color:var(--text-tertiary)',
  uploadProgress: 'position:relative',
  progressBar: 'height:4px;background:var(--surface-secondary);border-radius:2px;overflow:hidden;margin-bottom:4px',
  progressFill: 'height:100%;background:var(--brand-primary);border-radius:2px',
  progressText: 'font-size:11px;color:var(--text-tertiary);text-align:center',
}

const meta: Meta = {
  title: '📋 Tasks/TaskAttachments',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const Empty: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('h3', { style: S.title }, 'Attachments'),
      h('div', { style: S.dropZone }, [
        h('div', { style: S.dropIcon }, '🖼️'),
        h('div', { style: S.dropText }, 'Drop images here, click to browse, or paste from clipboard'),
      ]),
    ])}
  }),
}

export const WithThumbnails: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('h3', { style: S.title }, 'Attachments'),
      h('div', { style: S.dropZone }, [
        h('div', { style: S.dropIcon }, '🖼️'),
        h('div', { style: S.dropText }, 'Drop images here, click to browse, or paste from clipboard'),
      ]),
      h('div', { style: S.thumbnails }, [
        h('div', { style: S.thumb }, [
          h('div', { style: 'background:linear-gradient(135deg, #4ECDC4, #556270);width:100%;height:100%;border-radius:var(--radius-md)' }),
          h('button', { style: S.thumbDelete }, '✕'),
        ]),
        h('div', { style: S.thumb }, [
          h('div', { style: 'background:linear-gradient(135deg, #f59e0b, #ef4444);width:100%;height:100%;border-radius:var(--radius-md)' }),
          h('button', { style: S.thumbDelete }, '✕'),
        ]),
        h('div', { style: S.thumb }, [
          h('span', { style: S.thumbFallback }, '🖼️'),
          h('button', { style: S.thumbDelete }, '✕'),
        ]),
      ]),
    ])}
  }),
}

export const Uploading: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('h3', { style: S.title }, 'Attachments'),
      h('div', { style: S.dropZoneActive }, [
        h('div', { style: S.uploadProgress }, [
          h('div', { style: S.progressBar }, [h('div', { style: S.progressFill + ';width:65%' })]),
          h('div', { style: S.progressText }, 'Uploading 2 of 3 images...'),
        ]),
      ]),
    ])}
  }),
}

export const Disconnected: Story = {
  render: () => ({
    setup() { return () => h('div', { style: S.wrapper }, [
      h('h3', { style: S.title }, 'Attachments'),
      h('div', { style: S.dropZoneDisabled }, [
        h('div', { style: S.dropIcon }, '🖼️'),
        h('div', { style: S.dropText }, 'Connect Google account to attach images'),
      ]),
    ])}
  }),
}
