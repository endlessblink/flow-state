import { ref } from 'vue'

export interface FileSystemHandle {
    kind: 'file' | 'directory'
    name: string
}

export interface FileSystemDirectoryHandle extends FileSystemHandle {
    kind: 'directory'
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>
    values(): AsyncIterable<FileSystemHandle>
}

export interface FileSystemFileHandle extends FileSystemHandle {
    kind: 'file'
    createWritable(options?: { keepExistingData?: boolean }): Promise<FileSystemWritableFileStream>
    getFile(): Promise<File>
}

export interface FileSystemWritableFileStream extends WritableStream {
    write(data: string | BufferSource | Blob): Promise<void>
    seek(position: number): Promise<void>
    truncate(size: number): Promise<void>
    close(): Promise<void>
}

// Global declaration for the API
declare global {
    interface Window {
        showDirectoryPicker(options?: { id?: string; mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>
    }
}

class FileSystemService {
    private directoryHandle: FileSystemDirectoryHandle | null = null
    private isSupported = ref(false)

    constructor() {
        this.isSupported.value = 'showDirectoryPicker' in window
    }

    /**
     * Check if the browser supports the File System Access API
     */
    get isFileSystemSupported() {
        return this.isSupported
    }

    /**
     * Request the user to select a directory for export
     */
    async selectDirectory(): Promise<boolean> {
        if (!this.isSupported.value) {
            console.error('File System Access API not supported')
            return false
        }

        try {
            this.directoryHandle = await window.showDirectoryPicker({
                id: 'pomo-flow-export',
                mode: 'readwrite'
            })
            return true
        } catch (error) {
            if ((error as Error).name === 'AbortError') {
                // User cancelled
                return false
            }
            console.error('Error selecting directory:', error)
            throw error
        }
    }

    /**
     * Check if we have a valid directory handle
     */
    hasDirectoryHandle(): boolean {
        return !!this.directoryHandle
    }

    /**
     * Write text content to a file in the selected directory
     */
    async writeFile(filename: string, content: string): Promise<void> {
        if (!this.directoryHandle) {
            throw new Error('No directory selected')
        }

        try {
            const fileHandle = await this.directoryHandle.getFileHandle(filename, { create: true })
            const writable = await fileHandle.createWritable()
            await writable.write(content)
            await writable.close()
        } catch (error) {
            console.error(`Error writing file ${filename}:`, error)
            throw error
        }
    }

    /**
     * Verify we still have permission to write
     * (Browsers may revoke permission on reload)
     */
    async verifyPermission(readWrite = true): Promise<boolean> {
        if (!this.directoryHandle) return false

        const options = { mode: readWrite ? 'readwrite' : 'read' }

        // Check if permission was already granted
        // @ts-ignore - queryPermission types might be missing in some setups
        if ((await this.directoryHandle.queryPermission(options)) === 'granted') {
            return true
        }

        // Request permission (requires user gesture)
        // @ts-ignore
        if ((await this.directoryHandle.requestPermission(options)) === 'granted') {
            return true
        }

        return false
    }

    /**
     * Reset handle (e.g. to allow selecting a new folder)
     */
    clearDirectory(): void {
        this.directoryHandle = null
    }
}

export const fileSystemService = new FileSystemService()
