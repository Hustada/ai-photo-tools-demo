/**
 * Pipeline Logger - Logs to both browser console and server terminal
 * Makes it easier to track the 4-layer duplicate detection pipeline
 */

interface PipelineStats {
  layer: string;
  operation: string;
  inputCount: number;
  outputCount: number;
  duration: number;
  metadata?: Record<string, any>;
}

class PipelineLogger {
  private stats: PipelineStats[] = [];
  private analysisStartTime: number = 0;

  /**
   * Start a new analysis session
   */
  startAnalysis(photoCount: number) {
    this.stats = [];
    this.analysisStartTime = Date.now();
    
    const message = `🔍 DUPLICATE DETECTION PIPELINE STARTED - ${photoCount} photos`;
    this.logToBoth('info', message);
  }

  /**
   * Log a pipeline layer result
   */
  logLayer(
    layer: string,
    operation: string,
    inputCount: number,
    outputCount: number,
    duration: number,
    metadata: Record<string, any> = {}
  ) {
    const stat: PipelineStats = {
      layer,
      operation,
      inputCount,
      outputCount,
      duration,
      metadata
    };
    
    this.stats.push(stat);
    
    const efficiency = inputCount > 0 ? Math.round((1 - outputCount/inputCount) * 100) : 0;
    const message = `📊 ${layer} | ${operation}: ${inputCount} → ${outputCount} (${efficiency}% filtered) in ${duration}ms`;
    
    this.logToBoth('info', message, metadata);
  }

  /**
   * Log the final analysis summary
   */
  logSummary(finalGroups: number, totalPhotos: number) {
    const totalDuration = Date.now() - this.analysisStartTime;
    const totalApiCalls = this.stats
      .filter(s => s.layer.includes('Vision') || s.layer.includes('GPT'))
      .reduce((sum, s) => sum + s.outputCount, 0);
    
    const bruteForceApiCalls = (totalPhotos * (totalPhotos - 1)) / 2;
    const apiEfficiency = bruteForceApiCalls > 0 ? Math.round((1 - totalApiCalls/bruteForceApiCalls) * 100) : 0;
    
    const summary = {
      totalDuration: totalDuration + 'ms',
      finalGroups,
      totalPhotos,
      apiCalls: totalApiCalls,
      bruteForceApiCalls,
      apiEfficiency: apiEfficiency + '%',
      layerBreakdown: this.stats.map(s => ({
        layer: s.layer,
        operation: s.operation,
        efficiency: s.inputCount > 0 ? Math.round((1 - s.outputCount/s.inputCount) * 100) + '%' : 'N/A',
        duration: s.duration + 'ms'
      }))
    };
    
    this.logToBoth('success', `✅ PIPELINE COMPLETE: ${finalGroups} groups found in ${totalDuration}ms (${apiEfficiency}% API efficiency)`, summary);
  }

  /**
   * Log an error
   */
  logError(layer: string, error: string, details?: any) {
    this.logToBoth('error', `❌ ${layer} ERROR: ${error}`, details);
  }

  /**
   * Log to both browser console and server (via fetch to logging endpoint)
   */
  private async logToBoth(level: 'info' | 'success' | 'error', message: string, data?: any) {
    // Browser console with color coding
    const timestamp = new Date().toLocaleTimeString();
    const colorMap = {
      info: '#2196F3',     // Blue
      success: '#4CAF50',  // Green
      error: '#F44336'     // Red
    };
    
    console.log(
      `%c[${timestamp}] ${message}`,
      `color: ${colorMap[level]}; font-weight: bold;`
    );
    
    if (data) {
      console.log('%cData:', 'color: #666; font-size: 12px;', data);
    }
    
    // Send to server for terminal logging
    try {
      await fetch('/api/pipeline-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          level,
          message,
          data: data || null
        })
      });
    } catch (error) {
      // Silently fail - server logging is optional
      console.debug('Server logging failed:', error);
    }
  }

  /**
   * Get current pipeline statistics
   */
  getStats(): PipelineStats[] {
    return [...this.stats];
  }
}

// Singleton instance
export const pipelineLogger = new PipelineLogger();

// Convenience functions
export const logPipelineStart = (photoCount: number) => pipelineLogger.startAnalysis(photoCount);
export const logPipelineLayer = (layer: string, operation: string, inputCount: number, outputCount: number, duration: number, metadata?: Record<string, any>) => 
  pipelineLogger.logLayer(layer, operation, inputCount, outputCount, duration, metadata);
export const logPipelineSummary = (finalGroups: number, totalPhotos: number) => pipelineLogger.logSummary(finalGroups, totalPhotos);
export const logPipelineError = (layer: string, error: string, details?: any) => pipelineLogger.logError(layer, error, details);