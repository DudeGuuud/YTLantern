import { execSync } from 'child_process';
import { existsSync, rmSync, statSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const config = {
  tmpDir: join(__dirname, '../../tmp'),
  maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  maxDiskUsage: 90, // Maximum disk usage percentage
};

/**
 * Clean up old files and check disk space
 */
export function cleanupFiles() {
  try {
    console.log('Starting cleanup process...');
    
    // Check disk space first
    checkDiskSpace();
    
    // Clean old files
    cleanOldFiles();
    
    console.log('Cleanup process completed');
  } catch (error) {
    console.error('Cleanup error:', error);
  }
}

/**
 * Check disk space and clean if necessary
 */
function checkDiskSpace() {
  try {
    const df = execSync('df -h .', { encoding: 'utf8' });
    const lines = df.split('\n');
    
    for (const line of lines) {
      console.log('Disk space:', line);
      
      // Parse disk usage percentage
      const match = line.match(/.*\s(\d+)%/);
      if (match) {
        const usage = parseInt(match[1]);
        
        if (usage > config.maxDiskUsage) {
          console.log(`Disk usage ${usage}% exceeds limit ${config.maxDiskUsage}%, cleaning all files...`);
          cleanAllFiles();
          break;
        }
      }
    }
  } catch (error) {
    console.warn('Could not check disk space:', error.message);
  }
}

/**
 * Clean files older than maxAge
 */
function cleanOldFiles() {
  if (!existsSync(config.tmpDir)) {
    console.log('Tmp directory does not exist, nothing to clean');
    return;
  }

  const now = Date.now();
  let cleanedCount = 0;
  let totalSize = 0;

  try {
    const items = readdirSync(config.tmpDir);
    
    for (const item of items) {
      const itemPath = join(config.tmpDir, item);
      
      try {
        const stats = statSync(itemPath);
        const age = now - stats.mtime.getTime();
        
        if (age > config.maxAge) {
          console.log(`Removing old file/directory: ${item} (age: ${Math.round(age / 1000 / 60 / 60)}h)`);
          
          if (stats.isDirectory()) {
            rmSync(itemPath, { recursive: true, force: true });
          } else {
            totalSize += stats.size;
            rmSync(itemPath, { force: true });
          }
          
          cleanedCount++;
        }
      } catch (itemError) {
        console.warn(`Could not process item ${item}:`, itemError.message);
      }
    }
    
    console.log(`Cleaned ${cleanedCount} old items, freed ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  } catch (error) {
    console.error('Error cleaning old files:', error);
  }
}

/**
 * Clean all files (emergency cleanup)
 */
function cleanAllFiles() {
  try {
    if (existsSync(config.tmpDir)) {
      console.log('Emergency cleanup: removing all files...');
      rmSync(config.tmpDir, { recursive: true, force: true });
      
      // Recreate the directory
      import('fs').then(fs => {
        fs.mkdirSync(config.tmpDir, { recursive: true });
      });
      
      console.log('Emergency cleanup completed');
    }
  } catch (error) {
    console.error('Emergency cleanup failed:', error);
  }
}

/**
 * Get cleanup statistics
 * @returns {Object} Cleanup statistics
 */
export function getCleanupStats() {
  try {
    if (!existsSync(config.tmpDir)) {
      return {
        totalFiles: 0,
        totalSize: 0,
        oldFiles: 0,
        diskUsage: 'unknown'
      };
    }

    const now = Date.now();
    let totalFiles = 0;
    let totalSize = 0;
    let oldFiles = 0;

    function scanDirectory(dirPath) {
      const items = readdirSync(dirPath);
      
      for (const item of items) {
        const itemPath = join(dirPath, item);
        const stats = statSync(itemPath);
        
        if (stats.isDirectory()) {
          scanDirectory(itemPath);
        } else {
          totalFiles++;
          totalSize += stats.size;
          
          const age = now - stats.mtime.getTime();
          if (age > config.maxAge) {
            oldFiles++;
          }
        }
      }
    }

    scanDirectory(config.tmpDir);

    // Get disk usage
    let diskUsage = 'unknown';
    try {
      const df = execSync('df -h .', { encoding: 'utf8' });
      const match = df.match(/.*\s(\d+)%/);
      if (match) {
        diskUsage = `${match[1]}%`;
      }
    } catch (dfError) {
      console.warn('Could not get disk usage:', dfError.message);
    }

    return {
      totalFiles,
      totalSize: Math.round(totalSize / 1024 / 1024), // MB
      oldFiles,
      diskUsage,
      maxAge: config.maxAge / 1000 / 60 / 60, // hours
      tmpDir: config.tmpDir
    };
  } catch (error) {
    console.error('Error getting cleanup stats:', error);
    return {
      error: error.message
    };
  }
}
