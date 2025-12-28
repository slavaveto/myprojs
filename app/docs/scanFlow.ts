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
}

export async function scanFlowRefs(): Promise<CodeRef[]> {
  // Ignore node_modules AND the docs folder itself to prevent self-scanning
  const files = await glob('app/**/*.{ts,tsx}', { ignore: ['node_modules/**', 'app/docs/**'] });
  const refs: CodeRef[] = [];
  
  // Regex: // @ref:ID followed optionally by /Description
  // Capture group 1: ID
  // Capture group 2: Description (optional)
  const refRegex = /\/\/\s*@ref:([a-zA-Z0-9_-]+)(?:\/(.*))?/g;
  
  for (const file of files) {
      const absolutePath = path.join(process.cwd(), file);
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
              const description = match[2] ? match[2].trim() : undefined;
              
              // Get snippet (next 10 lines)
              const snippetLines = lines.slice(i + 1, i + 11);
              // Clean up snippet (remove indentation based on first line?)
              // For now raw is fine.
              const snippet = snippetLines.join('\n');

              refs.push({
                  id,
                  description,
                  fileName: file,
                  absolutePath,
                  lineNumber: i + 1, // 1-based index
                  snippet
              });
          }
      }
  }

  return refs;
}
