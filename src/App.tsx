import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, Calendar, ListTodo, Target, Edit2, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Todo {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  type: 'day' | 'month' | 'year';
  createdAt: number;
}

type TabType = 'day' | 'month' | 'year';

export default function App() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [inputTitle, setInputTitle] = useState('');
  const [inputDescription, setInputDescription] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('day');
  const [isInitialized, setIsInitialized] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('trendy-todos');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Migration: Handle old todos that only have 'text'
      const migrated = parsed.map((todo: any) => ({
        ...todo,
        title: todo.title || todo.text || '',
        description: todo.description || '',
      }));
      setTodos(migrated);
    }
    setIsInitialized(true);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('trendy-todos', JSON.stringify(todos));
    }
  }, [todos, isInitialized]);

  const addTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputTitle.trim()) return;

    const newTodo: Todo = {
      id: crypto.randomUUID(),
      title: inputTitle.trim(),
      description: inputDescription.trim(),
      completed: false,
      type: activeTab,
      createdAt: Date.now()
    };

    setTodos([newTodo, ...todos]);
    setInputTitle('');
    setInputDescription('');
  };

  const toggleTodo = (id: string) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id: string) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const startEdit = (todo: Todo) => {
    setEditingId(todo.id);
    setEditTitle(todo.title);
    setEditDescription(todo.description);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditDescription('');
  };

  const saveEdit = (id: string) => {
    if (!editTitle.trim()) return;
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, title: editTitle.trim(), description: editDescription.trim() } : todo
    ));
    setEditingId(null);
    setEditTitle('');
    setEditDescription('');
  };

  const filteredTodos = todos.filter(todo => todo.type === activeTab);

  const stats = {
    day: todos.filter(t => t.type === 'day' && !t.completed).length,
    month: todos.filter(t => t.type === 'month' && !t.completed).length,
    year: todos.filter(t => t.type === 'year' && !t.completed).length,
  };

  return (
    <div className="app-container">
      {/* Background decoration */}
      <div className="bg-glow bg-glow-1"></div>
      <div className="bg-glow bg-glow-2"></div>

      <header>
        <div className="header-content">
          <h1>My Goals</h1>
          <p>{new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</p>
        </div>
      </header>

      <nav className="tabs glass-card">
        <button
          className={activeTab === 'day' ? 'active' : ''}
          onClick={() => setActiveTab('day')}
        >
          <Calendar size={18} />
          <span>오늘</span>
          {stats.day > 0 && <span className="badge">{stats.day}</span>}
        </button>
        <button
          className={activeTab === 'month' ? 'active' : ''}
          onClick={() => setActiveTab('month')}
        >
          <ListTodo size={18} />
          <span>이번 달</span>
          {stats.month > 0 && <span className="badge">{stats.month}</span>}
        </button>
        <button
          className={activeTab === 'year' ? 'active' : ''}
          onClick={() => setActiveTab('year')}
        >
          <Target size={18} />
          <span>올해</span>
          {stats.year > 0 && <span className="badge">{stats.year}</span>}
        </button>
      </nav>

      <main>
        <form onSubmit={addTodo} className="input-group glass-card combined-input">
          <div className="input-fields">
            <input
              type="text"
              className="title-input"
              placeholder={
                activeTab === 'day' ? '오늘의 할 일 제목...' :
                  activeTab === 'month' ? '이번 달 목표 제목...' : '올해의 계획 제목...'
              }
              value={inputTitle}
              onChange={(e) => setInputTitle(e.target.value)}
            />
            <input
              type="text"
              className="desc-input"
              placeholder="상세 내용 (선택 사항)"
              value={inputDescription}
              onChange={(e) => setInputDescription(e.target.value)}
            />
          </div>
          <button type="submit" className="premium-button add-btn">
            <Plus size={28} />
          </button>
        </form>

        <div className="todo-list">
          <AnimatePresence mode="popLayout">
            {filteredTodos.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="empty-state"
              >
                <div className="glass-card">
                  <p>할 일이 없습니다. 새로운 목표를 추가해보세요!</p>
                </div>
              </motion.div>
            ) : (
              filteredTodos.map((todo) => (
                <motion.div
                  key={todo.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`todo-item glass-card ${todo.completed ? 'completed' : ''} ${editingId === todo.id ? 'editing' : ''}`}
                >
                  <button className="check-btn" onClick={() => toggleTodo(todo.id)}>
                    {todo.completed ? (
                      <CheckCircle2 color="#8b5cf6" size={24} />
                    ) : (
                      <Circle color="rgba(255,255,255,0.4)" size={24} />
                    )}
                  </button>

                  {editingId === todo.id ? (
                    <div className="edit-container">
                      <input
                        type="text"
                        className="edit-title"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        autoFocus
                        placeholder="제목"
                      />
                      <input
                        type="text"
                        className="edit-desc"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="상세 내용"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveEdit(todo.id);
                          if (e.key === 'Escape') cancelEdit();
                        }}
                      />
                      <div className="edit-actions">
                        <button className="save-btn" onClick={() => saveEdit(todo.id)}>
                          <Check size={20} />
                        </button>
                        <button className="cancel-btn" onClick={() => cancelEdit()}>
                          <X size={20} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="todo-content">
                        <span className="todo-title">{todo.title}</span>
                        {todo.description && <span className="todo-desc">{todo.description}</span>}
                      </div>
                      <div className="item-actions">
                        <button className="edit-btn" onClick={() => startEdit(todo)}>
                          <Edit2 size={18} />
                        </button>
                        <button className="delete-btn" onClick={() => deleteTodo(todo.id)}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </>
                  )}
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </main>

      <style>{`
        .app-container {
          padding: 24px 20px 100px;
          position: relative;
          z-index: 1;
        }

        .bg-glow {
          position: fixed;
          width: 300px;
          height: 300px;
          filter: blur(80px);
          z-index: -1;
          opacity: 0.3;
          border-radius: 50%;
        }

        .bg-glow-1 {
          background: var(--accent-primary);
          top: -100px;
          right: -100px;
        }

        .bg-glow-2 {
          background: var(--accent-secondary);
          bottom: -100px;
          left: -100px;
        }

        header {
          margin-bottom: 24px;
        }

        header h1 {
          font-size: 32px;
          font-weight: 800;
          background: linear-gradient(to right, #fff, rgba(255,255,255,0.6));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        header p {
          font-size: 14px;
          color: var(--text-secondary);
          margin-top: 4px;
        }

        .tabs {
          display: flex;
          padding: 6px;
          gap: 4px;
          margin-bottom: 24px;
        }

        .tabs button {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          padding: 10px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 600;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
        }

        .tabs button.active {
          background: rgba(255, 255, 255, 0.1);
          color: white;
          box-shadow: inset 0 0 10px rgba(255,255,255,0.05);
        }

        .badge {
          position: absolute;
          top: 6px;
          right: 12px;
          background: var(--accent-primary);
          color: white;
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 10px;
          min-width: 14px;
        }

        .combined-input {
          display: flex;
          flex-direction: row;
          align-items: center;
          padding: 12px;
          gap: 12px;
          margin-bottom: 24px;
        }

        .input-fields {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .input-fields input {
          background: transparent;
          border: none;
          padding: 4px;
          color: white;
          outline: none;
        }

        .title-input {
          font-size: 18px;
          font-weight: 700;
        }

        .desc-input {
          font-size: 14px;
          color: var(--text-secondary);
        }

        .add-btn {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          padding: 0;
        }

        .todo-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .todo-item {
          display: flex;
          align-items: flex-start;
          padding: 18px;
          gap: 14px;
          transition: all 0.3s;
        }

        .todo-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding-top: 2px;
        }

        .todo-title {
          font-size: 17px;
          font-weight: 600;
          line-height: 1.4;
        }

        .todo-desc {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .todo-item.completed {
          opacity: 0.6;
        }

        .todo-item.completed .todo-title,
        .todo-item.completed .todo-desc {
          text-decoration: line-through;
          color: var(--text-secondary);
        }

        .item-actions {
          display: flex;
          gap: 8px;
          opacity: 0.6;
          transition: opacity 0.2s;
          padding-top: 2px;
        }

        .todo-item:hover .item-actions {
          opacity: 1;
        }

        .edit-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .edit-container input {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid var(--accent-primary);
          border-radius: 8px;
          padding: 8px 12px;
          color: white;
          outline: none;
        }

        .edit-title {
          font-size: 16px;
          font-weight: 600;
        }

        .edit-desc {
          font-size: 14px;
        }

        .edit-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .edit-btn, .check-btn, .delete-btn, .save-btn, .cancel-btn {
          background: transparent;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
          border-radius: 8px;
          transition: background 0.2s;
        }

        .edit-btn {
          color: var(--text-secondary);
        }

        .edit-btn:hover {
          background: rgba(255,255,255,0.1);
          color: white;
        }

        .save-btn {
          color: #10b981;
        }

        .cancel-btn {
          color: #ef4444;
        }

        .delete-btn {
          color: rgba(255, 255, 255, 0.3);
          transition: color 0.2s;
        }

        .delete-btn:hover {
          color: #ef4444;
        }

        .empty-state {
          text-align: center;
          padding-top: 40px;
        }

        .empty-state .glass-card {
          padding: 40px 20px;
          color: var(--text-secondary);
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}
