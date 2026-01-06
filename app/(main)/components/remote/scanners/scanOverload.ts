'use server';

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

export interface OverloadFile {
  fileName: string; // Relative path
  absolutePath: string;
  lineCount: number;
}

export interface ScanResult {
  files: OverloadFile[];
  scannedPath: string;
}

export async function scanOverloadedFiles(projectFolderName?: string, threshold: number = 500): Promise<ScanResult> {
  let rootPath = process.cwd();
  // Standard ignore patterns only, as requested
  const ignorePatterns = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**'];
  
  if (projectFolderName) {
      rootPath = path.join('/Users/me/Projs', projectFolderName);
  }

  // Scan for code and style files
  const files = await glob('**/*.{ts,tsx,js,jsx,css,scss}', { 
      cwd: rootPath,
      ignore: ignorePatterns,
      nodir: true
  });
  
  const overloadedFiles: OverloadFile[] = [];
  
  for (const file of files) {
      const absolutePath = path.join(rootPath, file);
      try {
          const content = fs.readFileSync(absolutePath, 'utf-8');
          const lines = content.split('\n');
          
          if (lines.length > threshold) {
              overloadedFiles.push({
                  fileName: file,
                  absolutePath,
                  lineCount: lines.length
              });
          }
      } catch (e) {
      }
  }

  // Sort by line count descending
  return {
      files: overloadedFiles.sort((a, b) => b.lineCount - a.lineCount),
      scannedPath: rootPath
  };
}

