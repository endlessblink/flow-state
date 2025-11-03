/**
 * Firebase Database Adapter
 *
 * Implements the DatabaseAdapter interface for Firebase Firestore
 * All operations are user-scoped under users/{userId}/
 */

import type {
  DatabaseAdapter,
  TaskDatabaseAdapter,
  ProjectDatabaseAdapter,
  CanvasDatabaseAdapter
} from '../useDatabaseAdapter'
import type { Task, Project } from '@/stores/tasks'
import { db } from '@/config/firebase'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type Unsubscribe
} from 'firebase/firestore'

/**
 * Firebase Task Adapter
 */
class FirebaseTaskAdapter implements TaskDatabaseAdapter {
  async saveTask(userId: string, task: Task): Promise<void> {
    const taskRef = doc(db, 'users', userId, 'tasks', task.id)

    // Convert Date objects to Firestore Timestamps
    const firestoreTask = {
      ...task,
      createdAt: task.createdAt,
      updatedAt: serverTimestamp(),
      // Ensure dates are properly serialized
      dueDate: task.dueDate || null,
      scheduledDate: task.scheduledDate || null
    }

    await setDoc(taskRef, firestoreTask, { merge: true })
  }

  async loadTask(userId: string, taskId: string): Promise<Task | null> {
    const taskRef = doc(db, 'users', userId, 'tasks', taskId)
    const taskSnap = await getDoc(taskRef)

    if (!taskSnap.exists()) {
      return null
    }

    const data = taskSnap.data()
    return {
      ...data,
      id: taskSnap.id,
      createdAt: data.createdAt?.toDate?.() || new Date(),
      updatedAt: data.updatedAt?.toDate?.() || new Date()
    } as Task
  }

  async deleteTask(userId: string, taskId: string): Promise<void> {
    const taskRef = doc(db, 'users', userId, 'tasks', taskId)
    await deleteDoc(taskRef)
  }

  async saveTasks(userId: string, tasks: Task[]): Promise<void> {
    // Use batch writes for efficiency (max 500 per batch)
    const batchSize = 500
    const batches = []

    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = writeBatch(db)
      const batchTasks = tasks.slice(i, i + batchSize)

      for (const task of batchTasks) {
        const taskRef = doc(db, 'users', userId, 'tasks', task.id)
        const firestoreTask = {
          ...task,
          createdAt: task.createdAt,
          updatedAt: serverTimestamp()
        }
        batch.set(taskRef, firestoreTask, { merge: true })
      }

      batches.push(batch.commit())
    }

    await Promise.all(batches)
  }

  async loadTasks(userId: string): Promise<Task[]> {
    const tasksRef = collection(db, 'users', userId, 'tasks')
    const tasksQuery = query(tasksRef)
    const querySnapshot = await getDocs(tasksQuery)

    const tasks: Task[] = []
    querySnapshot.forEach((doc) => {
      const data = doc.data()
      tasks.push({
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date()
      } as Task)
    })

    return tasks
  }

  subscribeToTasks(userId: string, callback: (tasks: Task[]) => void): () => void {
    const tasksRef = collection(db, 'users', userId, 'tasks')
    const tasksQuery = query(tasksRef)

    const unsubscribe: Unsubscribe = onSnapshot(tasksQuery, (snapshot) => {
      const tasks: Task[] = []
      snapshot.forEach((doc) => {
        const data = doc.data()
        tasks.push({
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date()
        } as Task)
      })
      callback(tasks)
    })

    return unsubscribe
  }
}

/**
 * Firebase Project Adapter
 */
class FirebaseProjectAdapter implements ProjectDatabaseAdapter {
  async saveProject(userId: string, project: Project): Promise<void> {
    const projectRef = doc(db, 'users', userId, 'projects', project.id)

    const firestoreProject = {
      ...project,
      createdAt: project.createdAt,
      updatedAt: serverTimestamp()
    }

    await setDoc(projectRef, firestoreProject, { merge: true })
  }

  async loadProject(userId: string, projectId: string): Promise<Project | null> {
    const projectRef = doc(db, 'users', userId, 'projects', projectId)
    const projectSnap = await getDoc(projectRef)

    if (!projectSnap.exists()) {
      return null
    }

    const data = projectSnap.data()
    return {
      ...data,
      id: projectSnap.id,
      createdAt: data.createdAt?.toDate?.() || new Date(),
      updatedAt: data.updatedAt?.toDate?.() || new Date()
    } as Project
  }

  async deleteProject(userId: string, projectId: string): Promise<void> {
    const projectRef = doc(db, 'users', userId, 'projects', projectId)
    await deleteDoc(projectRef)
  }

  async saveProjects(userId: string, projects: Project[]): Promise<void> {
    const batchSize = 500
    const batches = []

    for (let i = 0; i < projects.length; i += batchSize) {
      const batch = writeBatch(db)
      const batchProjects = projects.slice(i, i + batchSize)

      for (const project of batchProjects) {
        const projectRef = doc(db, 'users', userId, 'projects', project.id)
        const firestoreProject = {
          ...project,
          createdAt: project.createdAt,
          updatedAt: serverTimestamp()
        }
        batch.set(projectRef, firestoreProject, { merge: true })
      }

      batches.push(batch.commit())
    }

    await Promise.all(batches)
  }

  async loadProjects(userId: string): Promise<Project[]> {
    const projectsRef = collection(db, 'users', userId, 'projects')
    const projectsQuery = query(projectsRef)
    const querySnapshot = await getDocs(projectsQuery)

    const projects: Project[] = []
    querySnapshot.forEach((doc) => {
      const data = doc.data()
      projects.push({
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate?.() || new Date(),
        updatedAt: data.updatedAt?.toDate?.() || new Date()
      } as Project)
    })

    return projects
  }

  subscribeToProjects(userId: string, callback: (projects: Project[]) => void): () => void {
    const projectsRef = collection(db, 'users', userId, 'projects')
    const projectsQuery = query(projectsRef)

    const unsubscribe: Unsubscribe = onSnapshot(projectsQuery, (snapshot) => {
      const projects: Project[] = []
      snapshot.forEach((doc) => {
        const data = doc.data()
        projects.push({
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date()
        } as Project)
      })
      callback(projects)
    })

    return unsubscribe
  }
}

/**
 * Firebase Canvas Adapter
 */
class FirebaseCanvasAdapter implements CanvasDatabaseAdapter {
  async saveCanvasState(userId: string, canvasData: any): Promise<void> {
    const canvasRef = doc(db, 'users', userId, 'canvas', 'state')

    const firestoreCanvas = {
      ...canvasData,
      updatedAt: serverTimestamp()
    }

    await setDoc(canvasRef, firestoreCanvas, { merge: true })
  }

  async loadCanvasState(userId: string): Promise<any> {
    const canvasRef = doc(db, 'users', userId, 'canvas', 'state')
    const canvasSnap = await getDoc(canvasRef)

    if (!canvasSnap.exists()) {
      return null
    }

    return canvasSnap.data()
  }

  subscribeToCanvas(userId: string, callback: (canvasData: any) => void): () => void {
    const canvasRef = doc(db, 'users', userId, 'canvas', 'state')

    const unsubscribe: Unsubscribe = onSnapshot(canvasRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data())
      }
    })

    return unsubscribe
  }
}

/**
 * Complete Firebase Database Adapter
 */
export class FirebaseAdapter implements DatabaseAdapter {
  readonly name = 'Firebase'
  readonly version = '1.0.0'

  tasks: TaskDatabaseAdapter
  projects: ProjectDatabaseAdapter
  canvas: CanvasDatabaseAdapter

  private connected = false

  constructor() {
    this.tasks = new FirebaseTaskAdapter()
    this.projects = new FirebaseProjectAdapter()
    this.canvas = new FirebaseCanvasAdapter()
  }

  async connect(): Promise<void> {
    // Firebase is always connected once initialized
    // This is a no-op but required by interface
    this.connected = true
  }

  async disconnect(): Promise<void> {
    // Firebase doesn't need explicit disconnect
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected
  }

  async ping(): Promise<boolean> {
    try {
      // Simple health check - try to read from Firestore
      const testRef = doc(db, '_health', 'ping')
      await getDoc(testRef)
      return true
    } catch (error) {
      console.error('Firebase ping failed:', error)
      return false
    }
  }
}
