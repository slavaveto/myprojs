export type FlowNodeType = 'start' | 'process' | 'decision' | 'success' | 'end';

export interface FlowMeta {
    id: string;
    label?: string; // Если не задано, берем из сообщения лога
    parentId?: string; // ID родительского узла
    type?: FlowNodeType;
    description?: string;
}

// Расширяем тип для использования в Logger
export interface LogDataWithFlow {
    flow?: FlowMeta;
    [key: string]: any;
}

