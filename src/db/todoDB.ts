import Dexie, { type Table } from 'dexie';

export interface Todo {
    id?: number; // IndexedDB uses auto-increment or explicit numbers
    title: string;
    description: string;
    completed: boolean;
    type: 'day' | 'month' | 'year';
    image?: Blob; // Storing images as Blobs for efficiency
    createdAt: number;
}

export class TodoDB extends Dexie {
    todos!: Table<Todo>;

    constructor() {
        super('TrendyTodoDB');
        this.version(1).stores({
            todos: '++id, type, completed, createdAt' // Define indexes
        });
    }
}

export const db = new TodoDB();
