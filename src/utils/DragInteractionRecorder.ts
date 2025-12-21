/**
 * DragInteractionRecorder - Records user drag interactions to bridge the gap between
 * synthetic testing and real user experience
 *
 * Purpose: Capture what users actually see and do during calendar drag operations
 * to identify visual barriers and interaction issues that synthetic testing misses.
 */

export interface MouseMovementEvent {
  timestamp: number;
  x: number;
  y: number;
  target: string;
  eventType: string;
}

export interface DragEventData {
  timestamp: number;
  type: string;
  target: string;
  data?: unknown;
}

export interface ScreenshotCapture {
  timestamp: number;
  dataUrl: string;
  description: string;
}

export interface InteractionAnalysis {
  success: boolean;
  barriers: string[];
  visualFeedbackIssues: string[];
  eventFlow: string[];
  recommendations: string[];
  timeline: {
    timestamp: number;
    event: string;
    visualEvidence?: string;
  }[];
}

export class DragInteractionRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private mouseMovements: MouseMovementEvent[] = [];
  private dragEvents: DragEventData[] = [];
  private screenshots: ScreenshotCapture[] = [];
  private isRecording: boolean = false;
  private recordingStartTime: number = 0;
  private eventLog: string[] = [];

  constructor() {
    this.setupConsoleCapture();
  }

  /**
   * Start recording user interactions
   */
  async startRecording(): Promise<void> {
    try {
      console.log('🎬 [DragRecorder] Starting interaction recording...');

      this.recordingStartTime = Date.now();
      this.recordedChunks = [];
      this.mouseMovements = [];
      this.dragEvents = [];
      this.screenshots = [];
      this.eventLog = [];

      // Start screen recording
      await this.startScreenRecording();

      // Start mouse tracking
      this.startMouseTracking();

      // Start drag event monitoring
      this.startDragEventMonitoring();

      // Start periodic screenshots
      this.startScreenshotCapture();

      this.isRecording = true;
      this.logEvent('Recording started');

      console.log('✅ [DragRecorder] Recording started successfully');
    } catch (error) {
      console.error('❌ [DragRecorder] Failed to start recording:', error);
      throw error;
    }
  }

  /**
   * Stop recording and return analysis
   */
  async stopRecording(): Promise<{ videoBlob: Blob; analysis: InteractionAnalysis }> {
    if (!this.isRecording) {
      throw new Error('Recording is not active');
    }

    console.log('⏹️ [DragRecorder] Stopping recording...');

    this.isRecording = false;
    this.logEvent('Recording stopped');

    // Stop all recording components
    this.stopScreenRecording();
    this.stopMouseTracking();
    this.stopDragEventMonitoring();
    this.stopScreenshotCapture();

    // Create video blob
    const videoBlob = await this.createVideoBlob();

    // Analyze interaction
    const analysis = this.analyzeInteraction();

    console.log('✅ [DragRecorder] Recording stopped and analyzed');

    return { videoBlob, analysis };
  }

  /**
   * Get current recording status
   */
  getStatus(): { isRecording: boolean; duration: number; eventsCaptured: number } {
    return {
      isRecording: this.isRecording,
      duration: this.isRecording ? Date.now() - this.recordingStartTime : 0,
      eventsCaptured: this.mouseMovements.length + this.dragEvents.length
    };
  }

  /**
   * Start screen recording using MediaRecorder API
   */
  private async startScreenRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser'
        },
        audio: false
      });

      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
      };

      this.mediaRecorder.start(100); // Collect data every 100ms
      this.logEvent('Screen recording started');

    } catch (error) {
      console.warn('⚠️ [DragRecorder] Screen recording failed, falling back to screenshots only:', error);
      // Continue without video recording, rely on screenshots
    }
  }

  /**
   * Stop screen recording
   */
  private stopScreenRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
      this.logEvent('Screen recording stopped');
    }
  }

  /**
   * Start tracking mouse movements
   */
  private startMouseTracking(): void {
    const mouseHandler = (event: MouseEvent) => {
      if (!this.isRecording) return;

      const movement: MouseMovementEvent = {
        timestamp: Date.now() - this.recordingStartTime,
        x: event.clientX,
        y: event.clientY,
        target: this.getElementIdentifier(event.target as Element),
        eventType: event.type
      };

      this.mouseMovements.push(movement);

      // Log significant mouse events
      if (event.type === 'mousedown' || event.type === 'mouseup') {
        this.logEvent(`Mouse ${event.type} at (${event.x}, ${event.y}) on ${movement.target}`);
      }
    };

    document.addEventListener('mousedown', mouseHandler);
    document.addEventListener('mouseup', mouseHandler);
    document.addEventListener('mousemove', mouseHandler, { passive: true });

    this.logEvent('Mouse tracking started');
  }

  /**
   * Stop mouse tracking
   */
  private stopMouseTracking(): void {
    // Note: In a real implementation, you'd want to store and remove the event listeners
    this.logEvent('Mouse tracking stopped');
  }

  /**
   * Start monitoring drag events specifically
   */
  private startDragEventMonitoring(): void {
    const dragTargets = ['.calendar-inbox-task', '.slot-task[draggable="true"]', '.time-slot'];

    dragTargets.forEach(selector => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(element => {
        // Monitor dragstart, dragover, drop events
        element.addEventListener('dragstart', (e: DragEvent) => this.captureDragEvent(e, 'dragstart'));
        element.addEventListener('dragover', (e: DragEvent) => this.captureDragEvent(e, 'dragover'));
        element.addEventListener('drop', (e: DragEvent) => this.captureDragEvent(e, 'drop'));
        element.addEventListener('dragend', (e: DragEvent) => this.captureDragEvent(e, 'dragend'));
      });
    });

    this.logEvent('Drag event monitoring started');
  }

  /**
   * Capture drag event data
   */
  private captureDragEvent(event: DragEvent, type: string): void {
    if (!this.isRecording) return;

    const dragEvent: DragEventData = {
      timestamp: Date.now() - this.recordingStartTime,
      type,
      target: this.getElementIdentifier(event.target as Element),
      data: {
        dataTransfer: event.dataTransfer?.types,
        clientX: event.clientX,
        clientY: event.clientY
      }
    };

    this.dragEvents.push(dragEvent);
    this.logEvent(`Drag ${type} on ${dragEvent.target}`);
  }

  /**
   * Stop drag event monitoring
   */
  private stopDragEventMonitoring(): void {
    this.logEvent('Drag event monitoring stopped');
  }

  /**
   * Start periodic screenshot capture
   */
  private startScreenshotCapture(): void {
    const captureInterval = setInterval(() => {
      if (!this.isRecording) {
        clearInterval(captureInterval);
        return;
      }

      this.captureScreenshot();
    }, 500); // Capture every 500ms

    this.logEvent('Screenshot capture started');
  }

  /**
   * Capture current screen state
   */
  private captureScreenshot(): void {
    // Note: This is a simplified implementation
    // In a real scenario, you might use html2canvas or similar library
    try {
      const canvas = document.createElement('canvas');
      const _ctx = canvas.getContext('2d');
      // This would need more implementation for actual screen capture

      this.screenshots.push({
        timestamp: Date.now() - this.recordingStartTime,
        dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', // Placeholder
        description: `Screenshot at ${Date.now() - this.recordingStartTime}ms`
      });
    } catch (_error) {
      // Screenshot failed, continue without it
    }
  }

  /**
   * Stop screenshot capture
   */
  private stopScreenshotCapture(): void {
    this.logEvent('Screenshot capture stopped');
  }

  /**
   * Create video blob from recorded chunks
   */
  private async createVideoBlob(): Promise<Blob> {
    if (this.recordedChunks.length === 0) {
      console.warn('⚠️ [DragRecorder] No video data recorded');
      return new Blob(); // Return empty blob
    }

    return new Blob(this.recordedChunks, { type: 'video/webm' });
  }

  /**
   * Analyze the recorded interaction to identify barriers
   */
  private analyzeInteraction(): InteractionAnalysis {
    const barriers: string[] = [];
    const visualFeedbackIssues: string[] = [];
    const eventFlow: string[] = [];
    const recommendations: string[] = [];
    const timeline: { timestamp: number; event: string; visualEvidence?: string }[] = [];

    // Analyze mouse movements
    const mouseDowns = this.mouseMovements.filter(m => m.eventType === 'mousedown');
    const _mouseUps = this.mouseMovements.filter(m => m.eventType === 'mouseup');

    // Check if drag was initiated
    if (mouseDowns.length === 0) {
      barriers.push('No mouse down events detected - user may not be able to click drag targets');
      recommendations.push('Verify drag targets are clickable and not blocked by other elements');
    }

    // Check if drag events fired
    const dragStarts = this.dragEvents.filter(e => e.type === 'dragstart');
    if (dragStarts.length === 0) {
      barriers.push('No dragstart events detected - drag may not be initiating properly');
      recommendations.push('Check draggable attributes and drag event handlers');
    }

    // Check for drop events
    const drops = this.dragEvents.filter(e => e.type === 'drop');
    if (drops.length === 0 && dragStarts.length > 0) {
      barriers.push('Drag initiated but no drop events - drop zones may not be receiving events');
      recommendations.push('Verify drop zones have proper event handlers and pointer-events enabled');
    }

    // Build timeline
    this.mouseMovements.forEach(movement => {
      timeline.push({
        timestamp: movement.timestamp,
        event: `Mouse ${movement.eventType} at (${movement.x}, ${movement.y})`,
        visualEvidence: `Target: ${movement.target}`
      });
    });

    this.dragEvents.forEach(event => {
      timeline.push({
        timestamp: event.timestamp,
        event: `Drag ${event.type} on ${event.target}`,
        visualEvidence: `Data: ${JSON.stringify(event.data)}`
      });
    });

    // Sort timeline by timestamp
    timeline.sort((a, b) => a.timestamp - b.timestamp);

    // Determine overall success
    const success = dragStarts.length > 0 && drops.length > 0;

    // Add recommendations based on findings
    if (!success) {
      recommendations.push('Consider adding more visual feedback during drag operations');
      recommendations.push('Verify cursor changes to indicate draggable areas');
      recommendations.push('Check for CSS z-index conflicts that may block interactions');
    }

    const analysis: InteractionAnalysis = {
      success,
      barriers,
      visualFeedbackIssues,
      eventFlow,
      recommendations,
      timeline
    };

    console.log('📊 [DragRecorder] Analysis complete:', analysis);
    return analysis;
  }

  /**
   * Get a meaningful identifier for an element
   */
  private getElementIdentifier(element: Element): string {
    if (!element) return 'unknown';

    // Try to get meaningful identifier
    if (element.className) {
      const classes = Array.from(element.classList);
      if (classes.includes('calendar-inbox-task')) return 'inbox-task';
      if (classes.includes('slot-task')) return 'calendar-task';
      if (classes.includes('time-slot')) return 'time-slot';
      if (classes.includes('resize-handle')) return 'resize-handle';
    }

    if (element.id) return `#${element.id}`;
    if (element.tagName) return element.tagName.toLowerCase();

    return 'unknown-element';
  }

  /**
   * Setup console event capture
   */
  private setupConsoleCapture(): void {
    // Store original console methods
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    // Override console methods to capture drag-related logs
    console.log = (...args: unknown[]) => {
      const message = args.join(' ');
      if (message.includes('drag') || message.includes('Drag') || message.includes('DROP') || message.includes('CALENDAR')) {
        this.eventLog.push(`[${Date.now()}] LOG: ${message}`);
      }
      originalLog.apply(console, args as Parameters<typeof console.log>);
    };

    console.warn = (...args: unknown[]) => {
      const message = args.join(' ');
      if (message.includes('drag') || message.includes('Drag')) {
        this.eventLog.push(`[${Date.now()}] WARN: ${message}`);
      }
      originalWarn.apply(console, args as Parameters<typeof console.warn>);
    };

    console.error = (...args: unknown[]) => {
      const message = args.join(' ');
      if (message.includes('drag') || message.includes('Drag')) {
        this.eventLog.push(`[${Date.now()}] ERROR: ${message}`);
      }
      originalError.apply(console, args as Parameters<typeof console.error>);
    };
  }

  /**
   * Log an event to the recording log
   */
  private logEvent(message: string): void {
    const timestamp = Date.now() - this.recordingStartTime;
    this.eventLog.push(`[${timestamp}ms] RECORDER: ${message}`);
    console.log(`🎬 [DragRecorder] [${timestamp}ms] ${message}`);
  }

  /**
   * Get the full event log
   */
  getEventLog(): string[] {
    return [...this.eventLog];
  }
}

// Export singleton instance
export const dragRecorder = new DragInteractionRecorder();