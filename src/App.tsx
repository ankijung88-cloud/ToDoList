import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, Calendar, ListTodo, Target, Edit2, Check, X, Mic, MicOff, Camera, FileText, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Todo } from './db/todoDB';
import { createWorker } from 'tesseract.js';

type TabType = 'day' | 'month' | 'year';

// Add type for SpeechRecognition
declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

export default function App() {
  const todos = useLiveQuery(() => db.todos.reverse().toArray()) || [];
  const [inputTitle, setInputTitle] = useState('');
  const [inputDescription, setInputDescription] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('day');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Voice State
  const [isListening, setIsListening] = useState(false);
  const [listeningTarget, setListeningTarget] = useState<'title' | 'description' | null>(null);
  const targetRef = useRef<'title' | 'description' | null>(null);
  const recognitionRef = useRef<any>(null);

  // Image State
  const [pendingImage, setPendingImage] = useState<Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // OCR State
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [ocrResult, setOcrResult] = useState<{ text: string; target: 'input' | 'todo'; todoId?: number } | null>(null);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window && !recognitionRef.current) {
      const SpeechRecognition = window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'ko-KR';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        const currentTarget = targetRef.current;

        if (currentTarget === 'title') {
          setInputTitle(prev => (prev ? prev + ' ' + transcript : transcript));
        } else if (currentTarget === 'description') {
          setInputDescription(prev => (prev ? prev + ' ' + transcript : transcript));
        }
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        setListeningTarget(null);
        targetRef.current = null;
      };
    }
  }, []);

  const toggleListening = (target: 'title' | 'description') => {
    if (isListening) {
      recognitionRef.current?.stop();
      if (listeningTarget === target) return;
    }

    targetRef.current = target;
    setListeningTarget(target);

    try {
      recognitionRef.current?.start();
      setIsListening(true);
    } catch (e) {
      console.error("Speech recognition start failed", e);
      setIsListening(false);
      setListeningTarget(null);
      targetRef.current = null;
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const recognizeText = async (image: Blob | string) => {
    setIsScanning(true);
    setScanProgress(0);
    try {
      const worker = await createWorker('kor+eng', 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            setScanProgress(Math.floor(m.progress * 100));
          }
        }
      });
      const { data: { text } } = await worker.recognize(image);
      await worker.terminate();
      return text;
    } catch (error) {
      console.error('OCR Error:', error);
      return '';
    } finally {
      setIsScanning(false);
      setScanProgress(0);
    }
  };

  const handleOcr = async (imageSource: Blob | string, target: 'input' | 'todo', todoId?: number) => {
    const text = await recognizeText(imageSource);
    if (!text) return;
    setOcrResult({ text, target, todoId });
  };

  const confirmOcr = async () => {
    if (!ocrResult) return;
    const { text, target, todoId } = ocrResult;

    if (target === 'input') {
      setInputDescription(prev => (prev ? prev + '\n' + text : text));
    } else if (target === 'todo' && todoId) {
      const todo = await db.todos.get(todoId);
      if (todo) {
        await db.todos.update(todoId, {
          description: todo.description ? todo.description + '\n' + text : text
        });
      }
    }
    setOcrResult(null);
  };

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputTitle.trim()) return;

    await db.todos.add({
      title: inputTitle.trim(),
      description: inputDescription.trim(),
      completed: false,
      type: activeTab,
      image: pendingImage || undefined,
      createdAt: Date.now()
    });

    setInputTitle('');
    setInputDescription('');
    setPendingImage(null);
    setImagePreview(null);
  };

  const toggleTodo = async (id?: number) => {
    if (!id) return;
    const todo = await db.todos.get(id);
    if (todo) {
      await db.todos.update(id, { completed: !todo.completed });
    }
  };

  const deleteTodo = async (id?: number) => {
    if (id) await db.todos.delete(id);
  };

  const startEdit = (todo: Todo) => {
    setEditingId(todo.id!);
    setEditTitle(todo.title);
    setEditDescription(todo.description);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
    setEditDescription('');
  };

  const saveEdit = async (id?: number) => {
    if (!id || !editTitle.trim()) return;
    await db.todos.update(id, {
      title: editTitle.trim(),
      description: editDescription.trim()
    });
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
      <div className="bg-glow bg-glow-1"></div>
      <div className="bg-glow bg-glow-2"></div>

      <header>
        <div className="header-content">
          <h1>My Goals</h1>
          <p>{new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}</p>
        </div>
      </header>

      {isScanning && (
        <div className="ocr-loader-overlay">
          <div className="ocr-loader-content glass-card">
            <Loader2 className="spinner" size={32} />
            <p>텍스트 스캔 중... {scanProgress}%</p>
          </div>
        </div>
      )}

      {ocrResult && (
        <div className="ocr-modal-overlay">
          <div className="ocr-modal-content glass-card">
            <h3>스캔 결과 확인 및 수정</h3>
            <textarea
              className="ocr-textarea"
              value={ocrResult.text}
              onChange={(e) => setOcrResult({ ...ocrResult, text: e.target.value })}
            />
            <div className="ocr-modal-actions">
              <button className="ocr-cancel-btn glass-card" onClick={() => setOcrResult(null)}>
                취소
              </button>
              <button className="ocr-confirm-btn premium-button" onClick={confirmOcr}>
                저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="tabs glass-card">
        <button className={activeTab === 'day' ? 'active' : ''} onClick={() => setActiveTab('day')}>
          <Calendar size={18} />
          <span>오늘</span>
          {stats.day > 0 && <span className="badge">{stats.day}</span>}
        </button>
        <button className={activeTab === 'month' ? 'active' : ''} onClick={() => setActiveTab('month')}>
          <ListTodo size={18} />
          <span>이번 달</span>
          {stats.month > 0 && <span className="badge">{stats.month}</span>}
        </button>
        <button className={activeTab === 'year' ? 'active' : ''} onClick={() => setActiveTab('year')}>
          <Target size={18} />
          <span>올해</span>
          {stats.year > 0 && <span className="badge">{stats.year}</span>}
        </button>
      </nav>

      <main>
        <form onSubmit={addTodo} className="input-group glass-card combined-input">
          <div className="input-fields">
            <div className="title-row">
              <input
                type="text"
                className="title-input"
                placeholder={activeTab === 'day' ? '오늘의 할 일...' : activeTab === 'month' ? '이번 달 목표...' : '올해의 계획...'}
                value={inputTitle}
                onChange={(e) => setInputTitle(e.target.value)}
              />
              <div className="input-actions">
                <button type="button" className={`icon-btn ${isListening && listeningTarget === 'title' ? 'listening' : ''}`} onClick={() => toggleListening('title')}>
                  {isListening && listeningTarget === 'title' ? <MicOff size={20} color="#ef4444" /> : <Mic size={20} />}
                </button>
                <button type="button" className="icon-btn" onClick={() => fileInputRef.current?.click()}>
                  <Camera size={20} />
                </button>
                <input
                  type="file"
                  hidden
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageChange}
                />
              </div>
            </div>
            <div className="desc-row">
              <input
                type="text"
                className="desc-input"
                placeholder="상세 설명 (선택 사항)"
                value={inputDescription}
                onChange={(e) => setInputDescription(e.target.value)}
              />
              <button type="button" className={`icon-btn mini-mic ${isListening && listeningTarget === 'description' ? 'listening' : ''}`} onClick={() => toggleListening('description')}>
                {isListening && listeningTarget === 'description' ? <MicOff size={16} color="#ef4444" /> : <Mic size={16} />}
              </button>
            </div>
            {imagePreview && (
              <div className="image-preview-wrapper">
                <div className="image-preview-container">
                  <img src={imagePreview} alt="Preview" className="image-preview" />
                  <button type="button" className="remove-img" onClick={() => { setPendingImage(null); setImagePreview(null); }}>
                    <X size={14} />
                  </button>
                </div>
                <button type="button" className="ocr-btn glass-card" onClick={() => pendingImage && handleOcr(pendingImage, 'input')}>
                  <FileText size={14} />
                  <span>텍스트 스캔</span>
                </button>
              </div>
            )}
          </div>
          <button type="submit" className="premium-button add-btn">
            <Plus size={28} />
          </button>
        </form>

        <div className="todo-list">
          <AnimatePresence mode="popLayout">
            {filteredTodos.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="empty-state">
                <div className="glass-card">
                  <p>할 일이 없거나 모두 완료했습니다! 🙌</p>
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
                      />
                      <input
                        type="text"
                        className="edit-desc"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit(todo.id)}
                      />
                      <div className="edit-actions">
                        <button className="save-btn" onClick={() => saveEdit(todo.id)}><Check size={20} /></button>
                        <button className="cancel-btn" onClick={() => cancelEdit()}><X size={20} /></button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="todo-content">
                        <span className="todo-title">{todo.title}</span>
                        {todo.description && <span className="todo-desc">{todo.description}</span>}
                        {todo.image && (
                          <div className="todo-multimedia">
                            <div className="todo-image-container">
                              <img src={URL.createObjectURL(todo.image)} alt="Task" className="todo-image" />
                            </div>
                            <button className="ocr-mini-btn glass-card" onClick={() => todo.image && handleOcr(todo.image, 'todo', todo.id)}>
                              <FileText size={12} />
                              <span>글자 추출</span>
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="item-actions">
                        <button className="edit-btn" onClick={() => startEdit(todo)}><Edit2 size={18} /></button>
                        <button className="delete-btn" onClick={() => deleteTodo(todo.id)}><Trash2 size={18} /></button>
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
        .app-container { padding: 24px 20px 100px; position: relative; z-index: 1; }
        .bg-glow { position: fixed; width: 300px; height: 300px; filter: blur(80px); z-index: -1; opacity: 0.3; border-radius: 50%; }
        .bg-glow-1 { background: var(--accent-primary); top: -100px; right: -100px; }
        .bg-glow-2 { background: var(--accent-secondary); bottom: -100px; left: -100px; }
        header { margin-bottom: 24px; }
        header h1 { font-size: 32px; font-weight: 800; background: linear-gradient(to right, #fff, rgba(255,255,255,0.6)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        header p { font-size: 14px; color: var(--text-secondary); margin-top: 4px; }
        
        .ocr-loader-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); backdrop-filter: blur(4px); z-index: 1000; display: flex; align-items: center; justify-content: center; }
        .ocr-loader-content { padding: 30px; display: flex; flex-direction: column; align-items: center; gap: 16px; border: 1px solid rgba(255,255,255,0.2); }
        .spinner { animation: spin 1s linear infinite; color: var(--accent-primary); }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

        .ocr-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); z-index: 1001; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .ocr-modal-content { width: 100%; max-width: 500px; padding: 24px; display: flex; flex-direction: column; gap: 16px; border: 1px solid rgba(255,255,255,0.2); }
        .ocr-modal-content h3 { font-size: 18px; font-weight: 700; color: white; }
        .ocr-textarea { width: 100%; height: 200px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px; color: white; font-size: 14px; line-height: 1.6; outline: none; resize: none; }
        .ocr-textarea:focus { border-color: var(--accent-primary); }
        .ocr-modal-actions { display: flex; justify-content: flex-end; gap: 12px; }
        .ocr-cancel-btn { padding: 8px 20px; color: white; cursor: pointer; }
        .ocr-confirm-btn { padding: 8px 24px; cursor: pointer; font-size: 14px; }

        .tabs { display: flex; padding: 6px; gap: 4px; margin-bottom: 24px; }
        .tabs button { flex: 1; background: transparent; border: none; color: var(--text-secondary); padding: 10px; border-radius: 14px; font-size: 13px; font-weight: 600; display: flex; flex-direction: column; align-items: center; gap: 6px; position: relative; }
        .tabs button.active { background: rgba(255, 255, 255, 0.1); color: white; }
        .badge { position: absolute; top: 6px; right: 12px; background: var(--accent-primary); color: white; font-size: 10px; padding: 2px 6px; border-radius: 10px; min-width: 14px; }
        
        .combined-input { display: flex; flex-direction: row; align-items: center; padding: 12px; gap: 12px; margin-bottom: 24px; }
        .input-fields { flex: 1; display: flex; flex-direction: column; gap: 10px; }
        .title-row { display: flex; align-items: center; gap: 8px; }
        .title-input { flex: 1; background: transparent; border: none; padding: 4px; color: white; outline: none; font-size: 18px; font-weight: 700; }
        .input-actions { display: flex; gap: 8px; }
        .icon-btn { background: rgba(255,255,255,0.05); border: none; color: white; width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
        .icon-btn:hover { background: rgba(255,255,255,0.15); }
        .listening { animation: pulse 1.5s infinite; background: rgba(239, 68, 68, 0.2); }
        @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
        
        .desc-row { display: flex; align-items: center; gap: 8px; }
        .desc-input { flex: 1; background: transparent; border: none; padding: 4px; color: var(--text-secondary); outline: none; font-size: 14px; }
        .mini-mic { width: 28px; height: 28px; opacity: 0.6; }
        .mini-mic:hover { opacity: 1; }
        
        .image-preview-wrapper { display: flex; align-items: center; gap: 12px; margin-top: 4px; }
        .image-preview-container { position: relative; width: fit-content; }
        .image-preview { width: 60px; height: 60px; border-radius: 8px; object-fit: cover; border: 1px solid rgba(255,255,255,0.2); }
        .remove-img { position: absolute; top: -5px; right: -5px; background: #ef4444; color: white; border: none; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; font-size: 10px; }
        .ocr-btn { display: flex; align-items: center; gap: 6px; padding: 8px 12px; font-size: 12px; color: white; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); }

        .add-btn { width: 56px; height: 56px; border-radius: 16px; padding: 0; }
        
        .todo-list { display: flex; flex-direction: column; gap: 12px; }
        .todo-item { display: flex; align-items: flex-start; padding: 18px; gap: 14px; }
        .todo-content { flex: 1; display: flex; flex-direction: column; gap: 6px; overflow: hidden; }
        .todo-title { font-size: 17px; font-weight: 600; line-height: 1.4; color: white; }
        .todo-desc { font-size: 13px; color: var(--text-secondary); line-height: 1.5; white-space: pre-wrap; }
        
        .todo-multimedia { margin-top: 8px; display: flex; flex-direction: column; gap: 8px; width: 100%; max-width: 200px; }
        .todo-image-container { border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); }
        .todo-image { width: 100%; height: auto; display: block; }
        .ocr-mini-btn { align-self: flex-start; display: flex; align-items: center; gap: 4px; padding: 4px 8px; font-size: 10px; color: white; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); }
        
        .todo-item.completed { opacity: 0.6; }
        .todo-item.completed .todo-title, .todo-item.completed .todo-desc { text-decoration: line-through; }
        
        .item-actions { display: flex; gap: 8px; opacity: 0.6; transition: opacity 0.2s; padding-top: 2px; }
        .todo-item:hover .item-actions { opacity: 1; }
        
        .edit-container { flex: 1; display: flex; flex-direction: column; gap: 10px; }
        .edit-container input { background: rgba(255, 255, 255, 0.1); border: 1px solid var(--accent-primary); border-radius: 8px; padding: 8px 12px; color: white; outline: none; }
        .edit-title { font-size: 16px; font-weight: 600; }
        .edit-desc { font-size: 14px; }
        .edit-actions { display: flex; justify-content: flex-end; gap: 12px; }
        
        .edit-btn, .check-btn, .delete-btn, .save-btn, .cancel-btn { background: transparent; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 8px; }
        .edit-btn { color: var(--text-secondary); }
        .save-btn { color: #10b981; }
        .cancel-btn { color: #ef4444; }
        .delete-btn { color: rgba(255, 255, 255, 0.3); }
        .delete-btn:hover { color: #ef4444; }
        
        .empty-state { text-align: center; padding-top: 40px; }
        .empty-state .glass-card { padding: 40px 20px; color: var(--text-secondary); font-size: 14px; }
      `}</style>
    </div>
  );
}
