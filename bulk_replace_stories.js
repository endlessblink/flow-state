import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const STORIES_DIR = path.join(__dirname, 'src', 'stories')

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

    // Match specific patterns
    newContent = newContent.replace(/\(story: any\)/g, '(story: Record<string, unknown>)')
    newContent = newContent.replace(/\(args: any\)/g, '(args: Record<string, unknown>)')
    newContent = newContent.replace(/\(app: any\)/g, '(app: Record<string, unknown>)')
    newContent = newContent.replace(/\(task: any\)/g, '(task: Record<string, unknown>)')
    newContent = newContent.replace(/\(project: any\)/g, '(project: Record<string, unknown>)')
    newContent = newContent.replace(/\(group: any\)/g, '(group: Record<string, unknown>)')
    newContent = newContent.replace(/\(category: any\)/g, '(category: Record<string, unknown>)')
    newContent = newContent.replace(/\(settings: any\)/g, '(settings: Record<string, unknown>)')
    newContent = newContent.replace(/\(event: any\)/g, '(event: Record<string, unknown>)')
    newContent = newContent.replace(/\(target: any\)/g, '(target: Record<string, unknown>)')
    newContent = newContent.replace(/\(item: any\)/g, '(item: Record<string, unknown>)')
    newContent = newContent.replace(/\(value: any\)/g, '(value: unknown)')
    newContent = newContent.replace(/as any\[\]/g, 'as unknown[]')
    newContent = newContent.replace(/ref<any\[\]>/g, 'ref<unknown[]>')
    newContent = newContent.replace(/ref<any>/g, 'ref<unknown>')
    newContent = newContent.replace(/as any/g, 'as unknown')
    newContent = newContent.replace(/any_unknown/g, 'any') // fix accidental double replacements if we ran it again

    // Generic any array
    newContent = newContent.replace(/: any\[\]/g, ': unknown[]')

    // Catch remaining cases
    newContent = newContent.replace(/: any\b/g, ': unknown')

    // Some story-specific cleanups:
    newContent = newContent.replace(/<any>/g, '<unknown>')

    if (content !== newContent) {
        fs.writeFileSync(filePath, newContent, 'utf-8')
        console.log(`Updated ${filePath}`)
    }
}

walkDir(STORIES_DIR, processFile)
console.log('Done replacing any in stories.')
