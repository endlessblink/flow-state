import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const SRC_DIR = path.join(__dirname, 'src')

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        const dirPath = path.join(dir, f)
        const isDirectory = fs.statSync(dirPath).isDirectory()
        isDirectory ? walkDir(dirPath, callback) : callback(dirPath)
    })
}

function processFile(filePath) {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.vue')) return

    const content = fs.readFileSync(filePath, 'utf-8')
    let newContent = content

    // Perform safe replacements
    newContent = newContent.replace(/as any\[\]/g, 'as unknown[]')
    newContent = newContent.replace(/ref<any\[\]>/g, 'ref<unknown[]>')
    newContent = newContent.replace(/ref<any>/g, 'ref<unknown>')
    newContent = newContent.replace(/Promise<any>/g, 'Promise<unknown>')
    newContent = newContent.replace(/Record<string, any>/g, 'Record<string, unknown>')
    newContent = newContent.replace(/Map<string, any>/g, 'Map<string, unknown>')
    newContent = newContent.replace(/Array<any>/g, 'Array<unknown>')
    newContent = newContent.replace(/as any\b/g, 'as unknown')

    // Generic function parameters
    newContent = newContent.replace(/\(e: any\)/g, '(e: unknown)')
    newContent = newContent.replace(/\(event: any\)/g, '(event: unknown)')
    newContent = newContent.replace(/\(err: any\)/g, '(err: unknown)')
    newContent = newContent.replace(/\(error: any\)/g, '(error: unknown)')
    newContent = newContent.replace(/\(item: any\)/g, '(item: unknown)')
    newContent = newContent.replace(/\(val: any\)/g, '(val: unknown)')
    newContent = newContent.replace(/\(value: any\)/g, '(value: unknown)')
    newContent = newContent.replace(/\(...args: any\[\]\)/g, '(...args: unknown[])')
    newContent = newContent.replace(/: any\[\]/g, ': unknown[]')
    newContent = newContent.replace(/: any\b/g, ': unknown')
    newContent = newContent.replace(/<any>/g, '<unknown>')

    if (content !== newContent) {
        fs.writeFileSync(filePath, newContent, 'utf-8')
        console.log(`Updated ${filePath}`)
    }
}

walkDir(SRC_DIR, processFile)
console.log('Done replacing global any usages.')
