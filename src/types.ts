export type Message = any;

export interface InfoElement {
    type: string;
    name: Message;
    value?: number | number[];
    formatted?: any;
    nameColor?: string;
    valueColor?: string;
}

export interface InfoBlock {
    type: string;
    elements?: InfoElement[];
    title?: any;
    text?: any;
}

export interface Item {
    id: string;
    category: string;
    name: Message;
    color?: string;
    status?: any;
    infoBlocks: InfoBlock[];
}
