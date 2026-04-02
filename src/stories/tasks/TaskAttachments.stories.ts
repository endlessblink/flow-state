import type { Meta, StoryObj } from '@storybook/vue3'
import { h } from 'vue'

const S = {
  wrapper: 'background:var(--bg-primary);border:1px solid var(--border-primary);border-radius:var(--radius-xl);padding:var(--space-5);max-width:500px',
  title: 'font-size:var(--text-sm);font-weight:600;color:var(--text-primary);margin-bottom:var(--space-3)',
  dropZone: 'border:2px dashed var(--border-secondary);border-radius:var(--radius-lg);padding:var(--space-5);text-align:center;cursor:pointer;transition:border-color 0.2s',
  dropZoneActive: 'border:2px dashed var(--brand-primary);border-radius:var(--radius-lg);padding:var(--space-5);text-align:center;cursor:pointer;background:var(--brand-primary-subtle)',
  dropZoneDisabled: 'border:2px dashed var(--border-primary);border-radius:var(--radius-lg);padding:var(--space-5);text-align:center;opacity:0.5;cursor:not-allowed',
  dropIcon: 'font-size:var(--text-xl);color:var(--text-tertiary);margin-bottom:var(--space-1)',
  dropText: 'font-size:var(--text-xs);color:var(--text-tertiary)',
  thumbnails: 'display:grid;grid-template-columns:repeat(4,1fr);gap:var(--space-2);margin-top:var(--space-3)',
  thumb: 'width:100%;aspect-ratio:1;background:var(--surface-secondary);border:1px solid var(--border-primary);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden;cursor:pointer',
  thumbImg: 'width:100%;height:100%;object-fit:cover;border-radius:var(--radius-md)',
  thumbDelete: 'position:absolute;top:var(--space-0_5);right:var(--space-0_5);width:18px;height:18px;border-radius:50%;background:var(--overlay-heavy);color:var(--text-primary);border:none;font-size:var(--text-xs);cursor:pointer;display:flex;align-items:center;justify-content:center',
  thumbFallback: 'font-size:var(--text-2xl);color:var(--text-tertiary)',
  uploadProgress: 'position:relative',
  progressBar: 'height:4px;background:var(--surface-secondary);border-radius:var(--radius-xs);overflow:hidden;margin-bottom:var(--space-1)',
  progressFill: 'height:100%;background:var(--brand-primary);border-radius:var(--radius-xs)',
  progressText: 'font-size:var(--text-xs);color:var(--text-tertiary);text-align:center',
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
