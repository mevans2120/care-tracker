import {
  PdfUploadPackage,
  UploadStatus,
  UploadResponse,
  ProcessingResult,
  RetryConfig,
  DEFAULT_RETRY_CONFIG,
  ApiError
} from '../types/pdfTypes';
import { TaskType, TaskStatus, TaskActionType, TaskCategory } from '../types';
import { logger, LogCategory } from '../utils/logger';

export class UploadManager {
  private retryConfig: RetryConfig;
  private activeUploads: Map<string, AbortController> = new Map();
  private statusPollers: Map<string, NodeJS.Timeout> = new Map();
  private backendResponses: Map<string, any> = new Map();

  constructor(retryConfig: Partial<RetryConfig> = {}) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
  }

  /**
   * Uploads a PDF package to the backend
   */
  async uploadPdf(
    uploadPackage: PdfUploadPackage,
    onProgress?: (status: UploadStatus) => void
  ): Promise<UploadResponse> {
    const uploadId = uploadPackage.uploadMetadata.uploadId;
    
    logger.info(LogCategory.UPLOAD_LIFECYCLE, 'UploadManager', 'Starting PDF upload', {
      fileName: uploadPackage.uploadMetadata.fileName,
      fileSize: uploadPackage.uploadMetadata.fileSize,
      timestamp: uploadPackage.uploadMetadata.timestamp
    }, uploadId);
    
    // Create abort controller for this upload
    const abortController = new AbortController();
    this.activeUploads.set(uploadId, abortController);

    try {
      onProgress?.({
        uploadId,
        status: 'uploading',
        progress: 0,
        message: 'Starting upload...',
      });

      const response = await this.uploadWithRetry(uploadPackage, abortController.signal, onProgress);
      
      logger.info(LogCategory.UPLOAD_LIFECYCLE, 'UploadManager', 'Upload completed successfully', {
        success: response.success,
        status: response.status,
        hasResult: !!response.result
      }, uploadId);
      
      // If we have an immediate result, trigger the completion callback
      if (response.success && response.result && onProgress) {
        logger.info(LogCategory.UPLOAD_LIFECYCLE, 'UploadManager', 'Immediate result available, triggering completion', {
          tasksCount: response.result.tasks.length
        }, uploadId);
        
        onProgress({
          uploadId,
          status: 'completed',
          progress: 100,
          message: 'Processing complete!',
          result: response.result,
        });
      } else if (response.success && onProgress) {
        // Fallback to status polling for legacy responses
        this.startStatusPolling(uploadId, onProgress);
      }

      return response;
    } catch (error) {
      logger.error(LogCategory.ERROR_HANDLING, 'UploadManager', 'Upload failed', error, {}, uploadId);
      this.cleanup(uploadId);
      throw error;
    }
  }

  /**
   * Polls upload status until completion
   */
  async pollStatus(uploadId: string): Promise<UploadStatus> {
    try {
      // In a real implementation, this would call the backend API
      // For now, we'll simulate the API response
      const response = await this.simulateStatusCheck(uploadId);
      return response;
    } catch (error) {
      throw new Error(`Failed to get status for upload ${uploadId}: ${error}`);
    }
  }

  /**
   * Starts automatic status polling
   */
  startStatusPolling(uploadId: string, onStatusUpdate: (status: UploadStatus) => void): void {
    // Clear any existing poller
    this.stopStatusPolling(uploadId);

    const poll = async () => {
      try {
        const status = await this.pollStatus(uploadId);
        onStatusUpdate(status);

        // Continue polling if still processing
        if (status.status === 'processing' || status.status === 'uploading') {
          const timeout = setTimeout(poll, 2000); // Poll every 2 seconds
          this.statusPollers.set(uploadId, timeout);
        } else {
          // Upload completed or failed, cleanup
          this.cleanup(uploadId);
        }
      } catch (error) {
        onStatusUpdate({
          uploadId,
          status: 'failed',
          progress: 0,
          message: 'Failed to check status',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        this.cleanup(uploadId);
      }
    };

    // Start polling after a short delay
    const timeout = setTimeout(poll, 1000);
    this.statusPollers.set(uploadId, timeout);
  }

  /**
   * Stops status polling for an upload
   */
  stopStatusPolling(uploadId: string): void {
    const timeout = this.statusPollers.get(uploadId);
    if (timeout) {
      clearTimeout(timeout);
      this.statusPollers.delete(uploadId);
    }
  }

  /**
   * Cancels an active upload
   */
  cancelUpload(uploadId: string): void {
    const abortController = this.activeUploads.get(uploadId);
    if (abortController) {
      abortController.abort();
    }
    this.cleanup(uploadId);
  }

  /**
   * Retries a failed upload
   */
  async retryUpload(
    uploadPackage: PdfUploadPackage,
    onProgress?: (status: UploadStatus) => void
  ): Promise<UploadResponse> {
    // Generate new upload ID for retry
    const newUploadId = crypto.randomUUID();
    const retryPackage = {
      ...uploadPackage,
      uploadMetadata: {
        ...uploadPackage.uploadMetadata,
        uploadId: newUploadId,
        timestamp: new Date().toISOString(),
      },
    };

    return this.uploadPdf(retryPackage, onProgress);
  }

  /**
   * Gets all active uploads
   */
  getActiveUploads(): string[] {
    return Array.from(this.activeUploads.keys());
  }

  /**
   * Cleans up resources for an upload
   */
  private cleanup(uploadId: string): void {
    this.activeUploads.delete(uploadId);
    this.stopStatusPolling(uploadId);
  }

  /**
   * Uploads with retry logic
   */
  private async uploadWithRetry(
    uploadPackage: PdfUploadPackage,
    signal: AbortSignal,
    onProgress?: (status: UploadStatus) => void
  ): Promise<UploadResponse> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.retryConfig.maxAttempts; attempt++) {
      try {
        if (signal.aborted) {
          throw new Error('Upload cancelled');
        }

        onProgress?.({
          uploadId: uploadPackage.uploadMetadata.uploadId,
          status: 'uploading',
          progress: Math.min((attempt - 1) * 10, 30),
          message: attempt === 1 ? 'Uploading...' : `Retry attempt ${attempt}...`,
        });

        const response = await this.performUpload(uploadPackage, signal, onProgress);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (signal.aborted || attempt === this.retryConfig.maxAttempts) {
          break;
        }

        // Wait before retry with exponential backoff
        const delay = Math.min(
          this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffFactor, attempt - 1),
          this.retryConfig.maxDelay
        );
        
        onProgress?.({
          uploadId: uploadPackage.uploadMetadata.uploadId,
          status: 'uploading',
          progress: attempt * 10,
          message: `Retrying in ${Math.round(delay / 1000)} seconds...`,
        });

        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Upload failed after all retry attempts');
  }

  /**
   * Performs the actual upload to the backend API
   */
  private async performUpload(
    uploadPackage: PdfUploadPackage,
    signal: AbortSignal,
    onProgress?: (status: UploadStatus) => void
  ): Promise<UploadResponse> {
    const uploadId = uploadPackage.uploadMetadata.uploadId;
    
    logger.debug(LogCategory.API_COMMUNICATION, 'UploadManager', 'Preparing JSON upload', {
      base64Length: uploadPackage.fileData.base64Content.length,
      mimeType: uploadPackage.fileData.mimeType,
      packageSize: JSON.stringify(uploadPackage).length
    }, uploadId);
    
    try {
      onProgress?.({
        uploadId,
        status: 'uploading',
        progress: 30,
        message: 'Uploading to server...',
      });

      logger.info(LogCategory.API_COMMUNICATION, 'UploadManager', 'Making JSON API request to Vercel function', {
        url: '/api/upload',
        method: 'POST',
        contentType: 'application/json',
        packageSize: JSON.stringify(uploadPackage).length
      }, uploadId);

      // Send the upload package as JSON to Vercel serverless function
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(uploadPackage),
        signal,
      });

      logger.info(LogCategory.API_COMMUNICATION, 'UploadManager', 'Received API response', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      }, uploadId);

      onProgress?.({
        uploadId,
        status: 'uploading',
        progress: 70,
        message: 'Processing response...',
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error(LogCategory.ERROR_HANDLING, 'UploadManager', 'API request failed',
          new Error(`${response.status} ${response.statusText}`),
          { errorText, responseHeaders: Object.fromEntries(response.headers.entries()) }, uploadId);
        throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      
      logger.info(LogCategory.API_COMMUNICATION, 'UploadManager', 'Parsed API response', {
        resultKeys: Object.keys(result),
        hasTimeFrames: !!result.time_frames,
        timeFramesCount: result.time_frames?.length || 0,
        hasParsedContent: !!result.parsed?.content?.[0]?.text,
        resultType: result.time_frames ? 'rule-based' : result.parsed ? 'ai-based' : result.tasks ? 'claude-direct' : 'unknown'
      }, uploadId);

      onProgress?.({
        uploadId,
        status: 'processing',
        progress: 90,
        message: 'Processing Claude response...',
      });

      // Process the Claude response immediately
      const processedResult = this.processBackendResponse(result);
      
      logger.info(LogCategory.API_COMMUNICATION, 'UploadManager', 'Claude response processed', {
        tasksExtracted: processedResult.tasks.length,
        medicationsExtracted: processedResult.medications.length,
        restrictionsExtracted: processedResult.restrictions.length,
        confidence: processedResult.confidence
      }, uploadId);

      onProgress?.({
        uploadId,
        status: 'completed',
        progress: 100,
        message: 'Processing complete!',
        result: processedResult,
      });

      return {
        success: true,
        uploadId,
        status: 'completed',
        result: processedResult,
      };

    } catch (error) {
      if (signal.aborted) {
        logger.warn(LogCategory.ERROR_HANDLING, 'UploadManager', 'Upload cancelled by user', {}, uploadId);
        throw new Error('Upload cancelled');
      }
      
      // Handle network errors gracefully
      if (error instanceof TypeError && error.message.includes('fetch')) {
        logger.error(LogCategory.ERROR_HANDLING, 'UploadManager', 'Vercel function connection failed', error, {
          message: 'Cannot connect to Vercel API function',
          url: '/api/upload'
        }, uploadId);
        throw new Error('Cannot connect to PDF processing API. Please check your connection and try again.');
      }
      
      logger.error(LogCategory.ERROR_HANDLING, 'UploadManager', 'Upload failed with unexpected error', error, {}, uploadId);
      throw error;
    }
  }

  /**
   * Processes backend response and returns status
   */
  private async simulateStatusCheck(uploadId: string): Promise<UploadStatus> {
    const backendResponse = this.backendResponses.get(uploadId);
    
    if (!backendResponse) {
      return {
        uploadId,
        status: 'processing',
        progress: 50,
        message: 'Processing PDF...',
      };
    }

    // Process the backend response immediately since it's already complete
    try {
      const processedResult = this.processBackendResponse(backendResponse);
      
      return {
        uploadId,
        status: 'completed',
        progress: 100,
        message: 'Processing complete!',
        result: processedResult,
      };
    } catch (error) {
      return {
        uploadId,
        status: 'failed',
        progress: 0,
        message: 'Failed to process backend response',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Creates mock processing result for demo
   */
  private createMockProcessingResult(): ProcessingResult {
    return {
      tasks: [], // Would be populated with extracted tasks
      emergencyInfo: {
        warningSignsTitle: 'When to Call 911',
        warningSignsDescription: 'Call emergency services immediately if you experience:',
        warningSignsList: [
          'Severe chest pain or pressure',
          'Difficulty breathing or shortness of breath',
          'Excessive bleeding from procedure site',
          'Signs of infection (fever, chills, redness)',
        ],
        emergencyContact: {
          name: 'Emergency Services',
          phone: '911',
          relationship: 'emergency',
        },
        doctorContact: {
          name: 'Dr. Smith',
          phone: '(555) 987-6543',
          specialty: 'Cardiology',
        },
      },
      medications: [],
      restrictions: [],
      confidence: 0.92,
      processingTime: 8500,
    };
  }

  /**
   * Stores backend response for later processing
   */
  private storeBackendResponse(uploadId: string, response: any): void {
    this.backendResponses.set(uploadId, response);
  }

  /**
   * Processes backend response and converts to frontend format
   */
  private processBackendResponse(backendResponse: any): ProcessingResult {
    logger.debug(LogCategory.UPLOAD_LIFECYCLE, 'UploadManager', 'Processing backend response', {
      responseKeys: Object.keys(backendResponse),
      hasAIFormat: !!backendResponse.parsed?.content?.[0]?.text,
      hasRuleFormat: !!backendResponse.time_frames,
      hasComprehensiveFormat: !!backendResponse.tasks,
      responseSize: JSON.stringify(backendResponse).length
    });

    // Handle comprehensive task format (new format)
    if (backendResponse.tasks && Array.isArray(backendResponse.tasks)) {
      logger.info(LogCategory.UPLOAD_LIFECYCLE, 'UploadManager', 'Detected comprehensive task format', {
        tasksCount: backendResponse.tasks.length,
        medicationsCount: backendResponse.medications?.length || 0
      });

      // Convert comprehensive tasks to frontend format
      const tasks = backendResponse.tasks.map((backendTask: any) => {
        logger.debug(LogCategory.UPLOAD_LIFECYCLE, 'UploadManager', 'Converting comprehensive task', {
          taskId: backendTask.id,
          taskType: backendTask.type,
          actionType: backendTask.actionType,
          title: backendTask.title
        });

        const task = {
          id: backendTask.id || crypto.randomUUID(),
          type: this.mapStringToTaskType(backendTask.type),
          title: backendTask.title || 'Care Task',
          description: backendTask.description || '',
          status: this.mapStringToTaskStatus(backendTask.status) || TaskStatus.PENDING,
          scheduledTime: new Date(backendTask.scheduledTime || new Date()),
          estimatedDuration: backendTask.estimatedDuration || 15,
          actionType: this.mapStringToActionType(backendTask.actionType) || TaskActionType.DO,
          category: this.mapStringToTaskCategory(backendTask.category) || TaskCategory.IMMEDIATE,
          instructions: backendTask.instructions || [backendTask.description || ''],
          reminders: backendTask.reminders || [],
          dependencies: backendTask.dependencies || [],
          metadata: {
            confidence: backendTask.metadata?.confidence || 0.95,
            source: backendTask.metadata?.source || 'discharge_instructions',
            pageNumber: backendTask.metadata?.pageNumber || 1,
            originalText: backendTask.metadata?.originalText || backendTask.description,
          },
        };

        logger.debug(LogCategory.UPLOAD_LIFECYCLE, 'UploadManager', 'Comprehensive task converted', {
          taskId: task.id,
          taskType: task.type,
          actionType: task.actionType,
          title: task.title
        });

        return task;
      });

      // Create restrictions from DO_NOT tasks
      const restrictions = tasks
        .filter((task: any) => task.actionType === TaskActionType.DO_NOT)
        .map((task: any, index: number) => ({
          id: `restriction-${index + 1}`,
          type: 'activity' as const,
          description: task.description,
          duration: `${task.estimatedDuration} hours`,
          severity: 'moderate' as const,
          consequences: 'May interfere with recovery process',
        }));

      logger.info(LogCategory.UPLOAD_LIFECYCLE, 'UploadManager', 'Comprehensive task conversion completed', {
        tasksCreated: tasks.length,
        restrictionsCreated: restrictions.length,
        doTasks: tasks.filter((t: any) => t.actionType === TaskActionType.DO).length,
        doNotTasks: tasks.filter((t: any) => t.actionType === TaskActionType.DO_NOT).length
      });

      const result = {
        tasks,
        emergencyInfo: this.createMockProcessingResult().emergencyInfo,
        medications: backendResponse.medications || [],
        restrictions,
        confidence: 0.95,
        processingTime: 1000,
      };

      logger.info(LogCategory.UPLOAD_LIFECYCLE, 'UploadManager', 'Comprehensive processing result created', {
        totalTasks: result.tasks.length,
        totalMedications: result.medications.length,
        totalRestrictions: result.restrictions.length,
        confidence: result.confidence
      });

      return result;
    }

    // Handle legacy formats (AI and rule-based)
    let timeFrames: any[] = [];
    
    if (backendResponse.parsed?.content?.[0]?.text) {
      // AI backend response format
      logger.debug(LogCategory.UPLOAD_LIFECYCLE, 'UploadManager', 'Detected AI backend response format');
      try {
        const rawText = backendResponse.parsed.content[0].text;
        logger.debug(LogCategory.UPLOAD_LIFECYCLE, 'UploadManager', 'Parsing AI response text', {
          textLength: rawText.length,
          startsWithJson: rawText.trim().startsWith('{'),
          containsTimeFrames: rawText.includes('time_frames')
        });
        
        const parsedContent = JSON.parse(rawText);
        timeFrames = parsedContent.time_frames || [];
        
        logger.info(LogCategory.UPLOAD_LIFECYCLE, 'UploadManager', 'Parsed AI response successfully', {
          timeFramesCount: timeFrames.length,
          parsedKeys: Object.keys(parsedContent)
        });
      } catch (error) {
        logger.error(LogCategory.ERROR_HANDLING, 'UploadManager', 'Failed to parse AI backend response', error, {
          rawText: backendResponse.parsed.content[0].text?.substring(0, 500) + '...'
        });
        timeFrames = [];
      }
    } else if (backendResponse.time_frames) {
      // Rule-based backend response format
      logger.debug(LogCategory.UPLOAD_LIFECYCLE, 'UploadManager', 'Detected rule-based backend response format');
      timeFrames = backendResponse.time_frames;
      logger.info(LogCategory.UPLOAD_LIFECYCLE, 'UploadManager', 'Using rule-based time frames', {
        timeFramesCount: timeFrames.length
      });
    } else {
      logger.warn(LogCategory.ERROR_HANDLING, 'UploadManager', 'Unknown backend response format', {
        responseKeys: Object.keys(backendResponse),
        response: JSON.stringify(backendResponse).substring(0, 500) + '...'
      });
    }

    logger.info(LogCategory.UPLOAD_LIFECYCLE, 'UploadManager', 'Converting time frames to tasks', {
      timeFramesCount: timeFrames.length
    });

    // Convert backend time_frames to frontend tasks (legacy format)
    const tasks = timeFrames.map((frame: any, index: number) => {
      logger.debug(LogCategory.UPLOAD_LIFECYCLE, 'UploadManager', 'Converting frame to task', {
        frameIndex: index,
        frameType: frame.type,
        frameTime: frame.time,
        frameUnit: frame.unit,
        frameMessage: frame.message?.substring(0, 100) + (frame.message?.length > 100 ? '...' : '')
      });
      
      const task = {
        id: `task-${index + 1}`,
        type: this.mapFrameTypeToTaskType(frame.type),
        title: this.generateTaskTitle(frame),
        description: frame.message || '',
        status: TaskStatus.PENDING,
        scheduledTime: this.calculateScheduledTime(frame),
        estimatedDuration: 15, // Default 15 minutes
        actionType: frame.type === 1 ? TaskActionType.DO_NOT : TaskActionType.DO,
        category: this.mapFrameTypeToCategory(frame.type),
        instructions: [frame.message || ''],
        reminders: [],
        dependencies: [],
        metadata: {
          confidence: 0.8,
          source: 'pdf_extraction',
          pageNumber: 1,
          originalText: frame.message,
        },
      };
      
      logger.debug(LogCategory.UPLOAD_LIFECYCLE, 'UploadManager', 'Task created', {
        taskId: task.id,
        taskType: task.type,
        actionType: task.actionType,
        title: task.title
      });
      
      return task;
    });

    // Create restrictions from DO_NOT tasks
    const restrictions = timeFrames
      .filter((frame: any) => frame.type === 1)
      .map((frame: any, index: number) => ({
        id: `restriction-${index + 1}`,
        type: 'activity' as const,
        description: frame.message || '',
        duration: this.formatDuration(frame.time, frame.unit),
        severity: 'moderate' as const,
        consequences: 'May interfere with recovery process',
      }));

    logger.info(LogCategory.UPLOAD_LIFECYCLE, 'UploadManager', 'Task conversion completed', {
      tasksCreated: tasks.length,
      restrictionsCreated: restrictions.length,
      doTasks: tasks.filter(t => t.actionType === TaskActionType.DO).length,
      doNotTasks: tasks.filter(t => t.actionType === TaskActionType.DO_NOT).length
    });

    const result = {
      tasks,
      emergencyInfo: this.createMockProcessingResult().emergencyInfo,
      medications: [],
      restrictions,
      confidence: 0.85,
      processingTime: 2000,
    };

    logger.info(LogCategory.UPLOAD_LIFECYCLE, 'UploadManager', 'Processing result created', {
      totalTasks: result.tasks.length,
      totalRestrictions: result.restrictions.length,
      confidence: result.confidence
    });

    return result;
  }

  /**
   * Maps string to TaskType enum
   */
  private mapStringToTaskType(type: string): TaskType {
    switch (type?.toUpperCase()) {
      case 'MEDICATION':
        return TaskType.MEDICATION;
      case 'APPOINTMENT':
        return TaskType.APPOINTMENT;
      case 'EXERCISE':
        return TaskType.EXERCISE;
      case 'WOUND_CARE':
        return TaskType.WOUND_CARE;
      case 'DIET':
        return TaskType.DIET;
      case 'ACTIVITY_RESTRICTION':
        return TaskType.ACTIVITY_RESTRICTION;
      case 'MONITORING':
        return TaskType.MONITORING;
      case 'EDUCATION':
        return TaskType.EDUCATION;
      case 'OTHER':
        return TaskType.OTHER;
      default:
        return TaskType.OTHER;
    }
  }

  /**
   * Maps string to TaskStatus enum
   */
  private mapStringToTaskStatus(status: string): TaskStatus {
    switch (status?.toUpperCase()) {
      case 'PENDING':
        return TaskStatus.PENDING;
      case 'IN_PROGRESS':
        return TaskStatus.IN_PROGRESS;
      case 'COMPLETED':
        return TaskStatus.COMPLETED;
      case 'SKIPPED':
        return TaskStatus.SKIPPED;
      case 'OVERDUE':
        return TaskStatus.OVERDUE;
      default:
        return TaskStatus.PENDING;
    }
  }

  /**
   * Maps string to TaskActionType enum
   */
  private mapStringToActionType(actionType: string): TaskActionType {
    switch (actionType?.toUpperCase()) {
      case 'DO':
        return TaskActionType.DO;
      case 'DO_NOT':
        return TaskActionType.DO_NOT;
      default:
        return TaskActionType.DO;
    }
  }

  /**
   * Maps string to TaskCategory enum
   */
  private mapStringToTaskCategory(category: string): TaskCategory {
    switch (category?.toUpperCase()) {
      case 'IMMEDIATE':
        return TaskCategory.IMMEDIATE;
      case 'SHORT_TERM':
        return TaskCategory.SHORT_TERM;
      case 'MEDIUM_TERM':
        return TaskCategory.MEDIUM_TERM;
      case 'LONG_TERM':
        return TaskCategory.LONG_TERM;
      default:
        return TaskCategory.IMMEDIATE;
    }
  }

  /**
   * Maps backend frame type to frontend task type
   */
  private mapFrameTypeToTaskType(type: number): TaskType {
    return type === 1 ? TaskType.ACTIVITY_RESTRICTION : TaskType.MEDICATION;
  }

  /**
   * Maps backend frame type to frontend category
   */
  private mapFrameTypeToCategory(type: number): TaskCategory {
    return type === 1 ? TaskCategory.IMMEDIATE : TaskCategory.SHORT_TERM;
  }

  /**
   * Formats duration from time and unit
   */
  private formatDuration(time: number, unit: string): string {
    if (!time || !unit) return 'As needed';
    return `${time} ${unit}${time > 1 ? 's' : ''}`;
  }

  /**
   * Generates a task title from the frame data
   */
  private generateTaskTitle(frame: any): string {
    const message = frame.message || '';
    if (message.length > 50) {
      return message.substring(0, 47) + '...';
    }
    return message || 'Care Task';
  }

  /**
   * Calculates scheduled time based on frame data
   */
  private calculateScheduledTime(frame: any): Date {
    const now = new Date();
    if (frame.time && frame.unit) {
      const hours = this.convertToHours(frame.time, frame.unit);
      return new Date(now.getTime() + (hours * 60 * 60 * 1000));
    }
    return now;
  }

  /**
   * Converts time units to hours
   */
  private convertToHours(time: number, unit: string): number {
    switch (unit.toLowerCase()) {
      case 'minute':
      case 'minutes':
        return time / 60;
      case 'hour':
      case 'hours':
        return time;
      case 'day':
      case 'days':
        return time * 24;
      case 'week':
      case 'weeks':
        return time * 24 * 7;
      default:
        return 1; // Default to 1 hour
    }
  }

  /**
   * Utility function for delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const uploadManager = new UploadManager();