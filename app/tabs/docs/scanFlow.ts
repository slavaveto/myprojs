'use server';

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

export interface CodeRef {
  id: string; // The unique ID (8a2b3c)
  description?: string; // Optional description from the comment line
  fileName: string; // Relative path
  absolutePath: string; // Absolute path for linking
  lineNumber: number; // Line number where @ref is found
  snippet: string; // Next 5 lines of code
  debug?: string; // Debug info
}

export async function scanFlowRefs(projectFolderName?: string): Promise<CodeRef[]> {
  // Determine root path
  // If projectFolderName is provided, look in /Users/me/Projs/{folderName}
  // Otherwise default to process.cwd() (current project)
  let rootPath = process.cwd();
  const ignorePatterns = ['**/node_modules/**', '**/dist/**', '**/build/**', '**/.next/**'];
  
  if (projectFolderName) {
      // TODO: Move base path to config/env
      rootPath = path.join('/Users/me/Projs', projectFolderName);
  } else {
      // If scanning CURRENT project, ignore the docs folder to avoid self-scanning
      ignorePatterns.push('app/docs/**');
  }

  // console.log('Scanning in:', rootPath);

  // Note: glob patterns are relative to cwd
  const files = await glob('**/*.{ts,tsx}', { 
      cwd: rootPath,
      ignore: ignorePatterns
  });
  
  const refs: CodeRef[] = [];
  
  // Regex: // @ref:ID followed optionally by /LinesCount
  // Capture group 1: ID
  // Capture group 2: LinesCount (optional, default 10)
  const refRegex = /\/\/\s*@ref:([a-zA-Z0-9_-]+)(?:\/(\d+))?/g;
  
  for (const file of files) {
      // HARD STOP: ALWAYS skip docs folder to prevent self-scanning
      if (file.includes('app/docs/')) {
          continue;
      }

      const absolutePath = path.join(rootPath, file);
      const content = fs.readFileSync(absolutePath, 'utf-8');
      const lines = content.split('\n');
      
      // Iterate line by line to easily get line numbers and snippets
      for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          // Reset regex state for each line just in case
          refRegex.lastIndex = 0;
          const match = refRegex.exec(line);
          
          if (match) {
              const id = match[1].trim();
              const linesCount = match[2] ? parseInt(match[2], 10) : 10;
              let description: string | undefined;
              let debugInfo = `Found ID: ${id}. `;
              
              // Debug log
              // console.log(`Found ref: ${id}, checking next line...`);

              // Always check next line for description comment
              if (lines[i + 1]) {
                  const nextLine = lines[i + 1].trim();
                  // console.log(`Next line trimmed: "${nextLine}"`);
                  debugInfo += `Next line: "${nextLine}". `;
                  
                  // Check for // comment
                  const commentMatch = nextLine.match(/^\/\/\s*(.*)/);
                  if (commentMatch) {
                      description = commentMatch[1].trim();
                      // console.log(`Description found: "${description}"`);
                      debugInfo += `Desc matched: "${description}".`;
                  } else {
                      debugInfo += `No comment match.`;
                  }
              }

              // Determine snippet start line. 
              // If we consumed the next line as description, start snippet from i+2
              // Otherwise i+1
              const snippetStartOffset = description ? 2 : 1;
              
              // Get snippet
              const snippetLines = lines.slice(i + snippetStartOffset, i + snippetStartOffset + linesCount);
              const snippet = snippetLines.join('\n');

              refs.push({
                  id,
                  description,
                  fileName: file,
                  absolutePath,
                  lineNumber: i + 1, // 1-based index
                  snippet,
                  debug: debugInfo
              });
          }
      }
  }

  return refs;
}
