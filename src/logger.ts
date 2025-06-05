/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'node:fs';
import path from 'node:path';

class Logger {
  private logFile: string;

  constructor() {
    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Create timestamped log file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(logsDir, `mcp-debug-${timestamp}.log`);
  }

  private writeLog(level: string, message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = data 
      ? `[${timestamp}] ${level}: ${message} ${JSON.stringify(data, null, 2)}\n`
      : `[${timestamp}] ${level}: ${message}\n`;
    
    try {
      fs.appendFileSync(this.logFile, logEntry);
    } catch (error) {
      // Silently fail - we can't log the logging error
    }
  }

  debug(message: string, data?: any) {
    this.writeLog('DEBUG', message, data);
  }

  info(message: string, data?: any) {
    this.writeLog('INFO', message, data);
  }

  warn(message: string, data?: any) {
    this.writeLog('WARN', message, data);
  }

  error(message: string, data?: any) {
    this.writeLog('ERROR', message, data);
  }

  getLogFile(): string {
    return this.logFile;
  }
}

// Export singleton instance
export const logger = new Logger();