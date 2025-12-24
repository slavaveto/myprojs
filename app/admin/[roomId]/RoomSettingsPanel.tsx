'use client';

import React, { useEffect } from 'react';
import { Card, CardBody, CardHeader, Divider } from '@heroui/react';
import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('RoomSettingsPanel');

interface RoomSettingsPanelProps {
   roomId: string;
}

export function RoomSettingsPanel({ roomId }: RoomSettingsPanelProps) {
   useEffect(() => {
      logger.info('🪪 RoomSettingsPanel открыт без изменяемых настроек', { roomId });
   }, [roomId]);

   return (
      <Card className="max-w-2xl">
         <CardHeader className="flex flex-col items-start gap-2 pb-4">
            <h3 className="text-xl font-semibold">Настройки комнаты</h3>
            <p className="text-sm text-default-500">
               На текущий момент для комнаты нет параметров, доступных из админки.
            </p>
         </CardHeader>
         <Divider />
         <CardBody className="pt-4">
            <p className="text-sm text-default-500">
               Измените конфигурацию напрямую в коде или добавьте новые опции, когда они появятся.
            </p>
         </CardBody>
      </Card>
   );
}

