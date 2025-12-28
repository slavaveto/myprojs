'use server';

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

export interface ArchNode {
  id: string;
  type: string;
  label: string;
  description?: string;
  absolutePath: string;
  fileName: string;
}

export interface ArchEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface ArchGraph {
  nodes: ArchNode[];
  edges: ArchEdge[];
}

export async function scanArchitecture(): Promise<ArchGraph> {
  const files = await glob('**/*.{ts,tsx}', { 
      ignore: ['node_modules/**', '.next/**', '.git/**'], 
      cwd: process.cwd() 
  });
  
  const nodes: ArchNode[] = [];
  const edges: ArchEdge[] = [];
  
  // Map: AbsoluteFilePath -> ComponentID
  // This helps us know "Who am I?" when we find a link inside a file.
  const fileToComponentMap = new Map<string, string>();

  // --- PASS 1: Find Components ---
  for (const file of files) {
      const absolutePath = path.join(process.cwd(), file);
      const content = fs.readFileSync(absolutePath, 'utf-8');
      
      const componentRegex = /\/\*\*([\s\S]*?)\*\//g;
      let match;
      
      while ((match = componentRegex.exec(content)) !== null) {
          const commentBlock = match[1];
          const compMatch = commentBlock.match(/@ArchComponent\s+([^\n\r]+)/);
          
          if (compMatch) {
              const id = compMatch[1].trim();
              const typeMatch = commentBlock.match(/@Type\s+([^\n\r]+)/);
              const descMatch = commentBlock.match(/@Desc\s+([^\n\r]+)/);
              
              nodes.push({
                  id,
                  type: typeMatch ? typeMatch[1].trim() : 'Service',
                  label: id,
                  description: descMatch ? descMatch[1].trim() : '',
                  fileName: file,
                  absolutePath
              });
              
              // Register this file as belonging to this component
              // Limitation: If multiple components per file, last one wins or we need line-based mapping.
              // For now, assume 1 main component per file.
              fileToComponentMap.set(absolutePath, id);
          }
      }
  }

  // --- PASS 2: Find Links ---
  // Implicit Nodes (External systems referenced in links but not defined)
  const implicitNodes = new Set<string>();

  for (const file of files) {
      const absolutePath = path.join(process.cwd(), file);
      const content = fs.readFileSync(absolutePath, 'utf-8');
      
      // Determine the default source for links in this file
      const currentFileComponentId = fileToComponentMap.get(absolutePath);

      const linkRegex = /\/\*\*([\s\S]*?)\*\//g;
      let match;
      
      while ((match = linkRegex.exec(content)) !== null) {
          const commentBlock = match[1];
          if (!commentBlock.includes('@ArchLink')) continue;

          // Parse Link Fields
          const toMatch = commentBlock.match(/@To:\s+([^\n\r]+)/);
          const fromMatch = commentBlock.match(/@From:\s+([^\n\r]+)/); // Override Source
          const labelMatch = commentBlock.match(/@Label\s+([^\n\r]+)/);
          const label = labelMatch ? labelMatch[1].trim() : undefined;

          let source = currentFileComponentId;
          let target = toMatch ? toMatch[1].trim() : undefined;

          // If explicit @From is present, use it
          if (fromMatch) {
              source = fromMatch[1].trim();
          }

          // Case 1: Outgoing Link (@To)
          if (target && source) {
               edges.push({
                  id: `${source}-${target}-${Math.random().toString(36).substr(2, 9)}`,
                  source,
                  target,
                  label
              });
              if (!nodes.find(n => n.id === target)) implicitNodes.add(target);
              if (!nodes.find(n => n.id === source)) implicitNodes.add(source);
          }
          
          // Case 2: Incoming Link (If using @From without @To, implies Target is Self)
          // But our regex above covers explicit @From.
          // If we have @From but NO @To, then Target = CurrentComponent
          if (fromMatch && !target && currentFileComponentId) {
              target = currentFileComponentId;
              edges.push({
                  id: `${source}-${target}-${Math.random().toString(36).substr(2, 9)}`,
                  source: source!, // source is defined from fromMatch
                  target,
                  label
              });
              if (!nodes.find(n => n.id === source)) implicitNodes.add(source!);
          }
      }
  }

  // Add implicit nodes to the graph so edges don't point to void
  implicitNodes.forEach(id => {
      // Don't add if already exists
      if (nodes.find(n => n.id === id)) return;
      
      nodes.push({
          id,
          type: 'System', 
          label: id,
          description: 'External / Implicit System',
          fileName: 'external',
          absolutePath: ''
      });
  });

  return { nodes, edges };
}
