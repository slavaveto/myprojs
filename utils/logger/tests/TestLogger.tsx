'use client';

import React from 'react';
import { Button } from '@heroui/react';
import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('TestLogger');

export default function TestLogger() {
   const handleLogs = () => {
      logger.info('Test log 1: Info message', { id: 1 });
      logger.success('Test log 2: Success operation', { status: 'ok' });
      logger.warning('Test log 3: Warning message', { attempt: 2 });
      logger.error('Test log 4: Error simulation', { error: 'Test error' });
      
      // Небольшая задержка для end
      setTimeout(() => {
         logger.end('Test log 5: Process finished');
      }, 500);
   };

   return (
      <div className="p-4 border border-default-200 rounded-lg m-4">
         <h3 className="text-lg font-bold mb-4">Test Logger Component</h3>
         <Button color="primary" onPress={handleLogs}>
            Fire 5 Logs
         </Button>
      </div>
   );
}

