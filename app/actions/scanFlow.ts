'use server';

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

export interface FlowNode {
  id: string;
  type: string;
  label: string;
  subtitle?: string;
  position: { x: number; y: number };
  data: { 
      label: string;
      subtitle?: string;
      type: string;
      source: string; 
      target: string;
      fileName: string; // Relative for display
      absolutePath: string; // Absolute for linking
      lineNumber: number;
      order: number;
  };
}

export interface FlowGraph {
  nodes: FlowNode[];
}

export async function scanFlow(): Promise<FlowGraph> {
  const files = await glob('app/**/*.{ts,tsx}', { ignore: 'node_modules/**' });
  
  const nodes: FlowNode[] = [];
  const flowBlockRegex = /\/\*\*([\s\S]*?)\*\//g;
  
  for (const file of files) {
      const absolutePath = path.join(process.cwd(), file);
      const content = fs.readFileSync(absolutePath, 'utf-8');
      
      let match;
      while ((match = flowBlockRegex.exec(content)) !== null) {
          const commentBlock = match[1];
          const flowMatch = commentBlock.match(/@FlowStep\s+([^\n\r]+)/);
          if (!flowMatch) continue;
          
          const flowName = flowMatch[1].trim();
          const idMatch = commentBlock.match(/@Id\s+([^\n\r]+)/);
          const titleMatch = commentBlock.match(/@Title\s+([^\n\r]+)/);
          const subtitleMatch = commentBlock.match(/@Subtitle\s+([^\n\r]+)/);
          const orderMatch = commentBlock.match(/@Order\s+(\d+)/);
          const typeMatch = commentBlock.match(/@Type\s+([^\n\r]+)/); 
          
          const id = idMatch ? idMatch[1].trim() : `auto_${Math.random()}`;
          const title = titleMatch ? titleMatch[1].trim() : id;
          const subtitle = subtitleMatch ? subtitleMatch[1].trim() : undefined;
          const order = orderMatch ? parseInt(orderMatch[1]) : 999;
          const type = typeMatch ? typeMatch[1].trim() : 'process';

          const upToMatch = content.substring(0, match.index);
          const lineNumber = upToMatch.split('\n').length + 1;

          nodes.push({
              id,
              type: 'default',
              label: title,
              subtitle,
              position: { x: 0, y: 0 },
              data: {
                  label: title,
                  subtitle,
                  type,
                  source: 'System',
                  target: 'System',
                  fileName: file, // Keep relative for clean UI display
                  absolutePath: absolutePath, // Pass full path for functionality
                  lineNumber,
                  order
              }
          });
      }
  }

  nodes.sort((a, b) => a.data.order - b.data.order);

  return { nodes };
}
