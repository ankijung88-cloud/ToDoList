import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, Calendar as CalendarIcon, ListTodo, Target, Edit2, Check, X, Mic, MicOff, Camera, FileText, Loader2, ArrowLeft, Smile } from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Todo } from './db/todoDB';
import { createWorker } from 'tesseract.js';
import { CalendarView } from './components/CalendarView';
import { isSameDay, format, isBefore, isAfter, startOfToday } from 'date-fns';
import { ko } from 'date-fns/locale';

type TabType = 'day' | 'month' | 'year' | 'incomplete';

// Add type for SpeechRecognition
declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

export default function App() {
  const allTodos = useLiveQuery(() => db.todos.reverse().toArray()) || [];
  const [inputTitle, setInputTitle] = useState('');
  const [inputDescription, setInputDescription] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('day');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editImages, setEditImages] = useState<Blob[]>([]);
  const [showEditEmoji, setShowEditEmoji] = useState(false);
  const [recentlyCompletedIds, setRecentlyCompletedIds] = useState<number[]>([]);

  // Calendar & View State
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Voice State
  const [isListening, setIsListening] = useState(false);
  const [listeningTarget, setListeningTarget] = useState<'title' | 'description' | null>(null);
  const targetRef = useRef<'title' | 'description' | null>(null);
  const recognitionRef = useRef<any>(null);

  // Image State
  // Image State
  const [pendingImages, setPendingImages] = useState<Blob[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // OCR State
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);


  // Emoji State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDescEmoji, setShowDescEmoji] = useState(false);

  // Detail Modal State
  const [showDetailModal, setShowDetailModal] = useState(false);

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
    const files = e.target.files;
    if (files && files.length > 0) {
      const newImages = Array.from(files);
      setPendingImages(prev => [...prev, ...newImages]);

      // Generate previews
      newImages.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreviews(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
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





  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputTitle.trim()) return;

    await db.todos.add({
      title: inputTitle.trim(),
      description: inputDescription.trim(),
      completed: false,
      type: activeTab === 'incomplete' ? 'day' : activeTab,
      images: pendingImages.length > 0 ? pendingImages : undefined,
      createdAt: selectedDate.getTime() // Use selected date for creation
    });

    setInputTitle('');
    setInputDescription('');
    setPendingImages([]);
    setImagePreviews([]);
  };

  const toggleTodo = async (id?: number) => {
    if (!id) return;
    const todo = await db.todos.get(id);
    if (todo) {
      if (activeTab === 'incomplete' && !todo.completed) {
        setRecentlyCompletedIds(prev => [...prev, id]);
      }
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
    // Load images: prefer 'images' array, fallback to single 'image' if exists
    const loadedImages = todo.images || (todo.image ? [todo.image] : []);
    setEditImages(loadedImages);
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
      description: editDescription.trim(),
      images: editImages
    });
    setEditingId(null);
    setEditTitle('');
    setEditDescription('');
    setEditImages([]);
    setShowEditEmoji(false);
  };

  // Filter Logic
  const filteredTodos = allTodos.filter(todo => {
    if (viewMode === 'calendar') return false;

    const todoDate = new Date(todo.createdAt);

    if (activeTab === 'day') {
      return todo.type === 'day' && isSameDay(todoDate, selectedDate);
    }
    if (activeTab === 'month') {
      return todo.type === 'month' && todoDate.getMonth() === selectedDate.getMonth() && todoDate.getFullYear() === selectedDate.getFullYear();
    }
    if (activeTab === 'year') {
      // Show ONLY FUTURE tasks for the selected year
      return todoDate.getFullYear() === selectedDate.getFullYear() && isAfter(todoDate, startOfToday());
    }
    if (activeTab === 'incomplete') {
      // Show if incomplete OR if it was recently completed in this session
      return (!todo.completed || recentlyCompletedIds.includes(todo.id!)) && isBefore(todoDate, startOfToday());
    }
    return false;
  }).sort((a, b) => {
    // Sort logic: Year tab wants Ascending (Oldest first), others keep Default (Newest first via allTodos)
    if (activeTab === 'year') {
      return a.createdAt - b.createdAt;
    }
    return 0; // Keep existing order (descending from useLiveQuery)
  });

  const stats = {
    day: allTodos.filter(t => t.type === 'day' && !t.completed && isSameDay(new Date(t.createdAt), new Date())).length,
    incomplete: allTodos.filter(t => !t.completed && isBefore(new Date(t.createdAt), startOfToday())).length,
    year: allTodos.filter(t => t.type === 'year' && !t.completed).length,
  };

  // Auto-resize textarea
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputDescription]);

  return (
    <div className="app-container">
      <div className="bg-shape bg-shape-1"></div>
      <div className="bg-shape bg-shape-2"></div>

      <header>
        <div className="header-content">
          <div>
            <h1>My Goals</h1>
            <p className="current-date-display">
              {format(selectedDate, 'PPP EEEE', { locale: ko })}
              {activeTab === 'incomplete' ? (
                <span className="date-context past">(과거 기록)</span>
              ) : activeTab === 'year' ? (
                <span className="date-context future">(미래 기록)</span>
              ) : (
                <>
                  {isSameDay(selectedDate, startOfToday()) ? (
                    <span className="date-context current">(현재 기록)</span>
                  ) : isBefore(selectedDate, startOfToday()) ? (
                    <span className="date-context past">(과거 기록)</span>
                  ) : (
                    <span className="date-context future">(미래 기록)</span>
                  )}
                </>
              )}
            </p>
          </div>
          <button
            className={`view-toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`}
            onClick={() => setViewMode(prev => prev === 'list' ? 'calendar' : 'list')}
          >
            {viewMode === 'list' ? <CalendarIcon size={24} /> : <ArrowLeft size={24} />}
          </button>
        </div>
      </header>

      {viewMode === 'calendar' ? (
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <CalendarView
            todos={allTodos}
            selectedDate={selectedDate}
            onSelectDate={(date) => {
              setSelectedDate(date);
              setViewMode('list');
              setActiveTab('day'); // Switch to daily view for that date
            }}
          />
        </motion.div>
      ) : (
        <>
          <nav className="tabs glass-card">
            <button className={activeTab === 'day' ? 'active' : ''} onClick={() => { setActiveTab('day'); setSelectedDate(new Date()); }}>
              <CalendarIcon size={18} />
              <span>오늘</span>
              {stats.day > 0 && <span className="badge">{stats.day}</span>}
            </button>
            <button className={activeTab === 'incomplete' ? 'active' : ''} onClick={() => setActiveTab('incomplete')}>
              <ListTodo size={18} />
              <span>미완료</span>
              {stats.incomplete > 0 && <span className="badge">{stats.incomplete}</span>}
            </button>
            <button className={activeTab === 'year' ? 'active' : ''} onClick={() => setActiveTab('year')}>
              <Target size={18} />
              <span>{format(selectedDate, 'yyyy년')}</span>
              {stats.year > 0 && <span className="badge">{stats.year}</span>}
            </button>
          </nav>

          <main>
            {(activeTab !== 'incomplete' && activeTab !== 'year') && (
              <form onSubmit={addTodo} className="input-group glass-card">
                <div className="input-fields">
                  <div className="input-row">
                    <input
                      type="text"
                      className="title-input"
                      placeholder={activeTab === 'day' ? '할 일 제목...' : '목표 제목...'}
                      value={inputTitle}
                      onChange={(e) => setInputTitle(e.target.value)}
                    />
                    <div className="action-grid">
                      <button type="button" className={`icon-btn ${isListening && listeningTarget === 'title' ? 'listening' : ''}`} onClick={() => toggleListening('title')}>
                        {isListening && listeningTarget === 'title' ? <MicOff size={20} color="#ff6b6b" /> : <Mic size={20} />}
                      </button>
                      <div style={{ position: 'relative' }}>
                        <button type="button" className="icon-btn" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                          <Smile size={20} color={showEmojiPicker ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
                        </button>
                        {showEmojiPicker && (
                          <div style={{ position: 'absolute', top: '40px', right: 0, zIndex: 10 }}>
                            <EmojiPicker
                              onEmojiClick={(emojiObject: any) => {
                                setInputTitle(prev => prev + emojiObject.emoji);
                                setShowEmojiPicker(false);
                              }}
                              width={300}
                              height={400}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="input-row desc-row" onClick={() => setShowDetailModal(true)} style={{ cursor: 'pointer' }}>
                    <textarea
                      readOnly
                      className="desc-textarea"
                      placeholder="상세 설명 (클릭하여 입력)"
                      value={inputDescription}
                      rows={1}
                      style={{ pointerEvents: 'none' }} // Pass click to parent
                    />
                    <div className="action-grid">
                      {/* Show small icons as indicators that features are inside */}
                      <ListTodo size={18} color="var(--text-secondary)" />
                    </div>
                    {/* Hidden file input needs to stay in DOM but can be triggered from modal */}
                    <input
                      type="file"
                      hidden
                      ref={fileInputRef}
                      accept="image/*"
                      multiple
                      onChange={handleImageChange}
                    />
                  </div>
                </div>
                <button type="submit" className="premium-button add-btn" aria-label="할 일 추가">
                  <Plus size={28} strokeWidth={3} style={{ minWidth: '28px', minHeight: '28px' }} />
                </button>
              </form>
            )}

            <div className="todo-list">
              <AnimatePresence mode="popLayout">
                {filteredTodos.length === 0 ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="empty-state">
                    <div className="glass-card">
                      <p>기록된 내용이 없습니다 ✨</p>
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

                      {editingId === todo.id ? (
                        <div className="edit-container">
                          <input
                            type="text"
                            className="edit-title"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            autoFocus
                            placeholder="할 일 제목"
                          />

                          <div className="edit-separator"></div>

                          <textarea
                            className="edit-desc"
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            placeholder="상세 내용을 입력하세요"
                            rows={3}
                          />

                          {/* New Styled Toolbar */}
                          <div className="edit-tools-bar">
                            <label className="edit-tool-btn">
                              <Camera size={20} />
                              <input
                                type="file"
                                hidden
                                accept="image/*"
                                multiple
                                onChange={(e) => {
                                  if (e.target.files && e.target.files.length > 0) {
                                    const newFiles = Array.from(e.target.files);
                                    setEditImages(prev => [...prev, ...newFiles]);
                                  }
                                }}
                              />
                            </label>

                            <div style={{ position: 'relative' }}>
                              <button className="edit-tool-btn" onClick={() => setShowEditEmoji(!showEditEmoji)}>
                                <Smile size={20} color={showEditEmoji ? 'var(--accent-primary)' : '#64748b'} />
                              </button>
                              {showEditEmoji && (
                                <div style={{ position: 'absolute', top: '45px', left: 0, zIndex: 50 }}>
                                  <EmojiPicker
                                    onEmojiClick={(emojiObject: any) => {
                                      setEditDescription(prev => prev + emojiObject.emoji); // Add to description
                                      setShowEditEmoji(false);
                                    }}
                                    width={300}
                                    height={400}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Edit Mode Images List */}
                          {editImages.length > 0 && (
                            <div className="edit-images-section">
                              <div className="images-list">
                                {editImages.map((img, idx) => (
                                  <div key={idx} className="edit-image-thumbnail">
                                    <img src={URL.createObjectURL(img)} alt="thumbnail" />
                                    <button className="remove-edit-img" onClick={() => setEditImages(prev => prev.filter((_, i) => i !== idx))}>
                                      <X size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="edit-actions">
                            <button className="save-btn" onClick={() => saveEdit(todo.id)}><Check size={20} /></button>
                            <button className="cancel-btn" onClick={() => {
                              cancelEdit();
                              setShowEditEmoji(false);
                              setEditImages([]);
                            }}><X size={20} /></button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="todo-header-row">
                            <div className="todo-header-left">
                              <button className="check-btn" onClick={() => toggleTodo(todo.id)}>
                                {todo.completed ? (
                                  <CheckCircle2 color="var(--accent-secondary)" size={24} />
                                ) : (
                                  <Circle color="#cbd5e1" size={24} />
                                )}
                              </button>

                              {/* Show date badge in Incomplete AND Year tab */}
                              {(activeTab === 'incomplete' || activeTab === 'year') && (
                                <span className="todo-date-badge">
                                  {format(new Date(todo.createdAt), 'M.d')}
                                </span>
                              )}
                            </div>

                            <div className="item-actions">
                              <button className="edit-btn" onClick={() => startEdit(todo)}><Edit2 size={18} /></button>
                              <button className="delete-btn" onClick={() => deleteTodo(todo.id)}><Trash2 size={18} /></button>
                            </div>
                          </div>

                          <div className="todo-content">
                            <span className="todo-title">{todo.title}</span>
                            {todo.description && <span className="todo-desc">{todo.description}</span>}
                            {/* Display Images (Legacy + New) */}
                            {(() => {
                              const imagesToShow = todo.images && todo.images.length > 0 ? todo.images : (todo.image ? [todo.image] : []);
                              if (imagesToShow.length === 0) return null;
                              return (
                                <div className="todo-multimedia">
                                  <div className="images-grid">
                                    {imagesToShow.map((img, idx) => (
                                      <div
                                        key={idx}
                                        className="todo-image-container"
                                        onClick={() => setFullscreenImage(URL.createObjectURL(img))}
                                        style={{ cursor: 'pointer' }}
                                        role="button"
                                        tabIndex={0}
                                      >
                                        <img src={URL.createObjectURL(img)} alt={`Task attachment ${idx}`} className="todo-image" />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                        </>
                      )}
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </main>
        </>
      )}

      {/* Global & Shared Overlays (OCR) */}
      {isScanning && (
        <div className="ocr-loader-overlay">
          <div className="ocr-loader-content glass-card">
            <Loader2 className="spinner" size={32} />
            <p>텍스트 스캔 중... {scanProgress}%</p>
          </div>
        </div>
      )}

      {/* Detail Input Modal */}
      <AnimatePresence>
        {showDetailModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-overlay"
            onClick={() => setShowDetailModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="modal-content glass-card"
              onClick={(e) => e.stopPropagation()}
            >
              <h3>상세 설명 입력</h3>
              <textarea
                className="modal-textarea"
                placeholder="할 일에 대한 상세한 내용을 자유롭게 적어주세요..."
                value={inputDescription}
                onChange={(e) => setInputDescription(e.target.value)}
                autoFocus
              />

              {imagePreviews.length > 0 && (
                <div className="modal-images-scroll-container">
                  {imagePreviews.map((preview, idx) => (
                    <div key={idx} className="modal-image-preview">
                      <img src={preview} alt={`Preview ${idx}`} />
                      <button onClick={() => {
                        setPendingImages(prev => prev.filter((_, i) => i !== idx));
                        setImagePreviews(prev => prev.filter((_, i) => i !== idx));
                      }} className="remove-img-btn">
                        <X size={16} />
                      </button>
                      {/* Only show OCR extraction on the first image for now or add granular control later */}
                      {idx === 0 && (
                        <button
                          className="scan-text-btn glass-card"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (pendingImages[0]) {
                              const text = await recognizeText(pendingImages[0]);
                              if (text) setInputDescription(prev => prev ? prev + '\n' + text : text);
                            }
                          }}
                        >
                          <FileText size={14} />
                          <span>텍스트 추출 (1번)</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="modal-actions-row">
                <div className="left-actions">
                  <button type="button" className={`icon-btn ${isListening && listeningTarget === 'description' ? 'listening' : ''}`} onClick={() => toggleListening('description')}>
                    {isListening && listeningTarget === 'description' ? <MicOff size={22} color="#ff6b6b" /> : <Mic size={22} />}
                  </button>
                  <button type="button" className="icon-btn" onClick={() => fileInputRef.current?.click()}>
                    <Camera size={22} />
                  </button>
                  {/* Emoji Picker for Description */}
                  <div style={{ position: 'relative' }}>
                    <button type="button" className="icon-btn" onClick={() => setShowDescEmoji(!showDescEmoji)}>
                      <Smile size={22} color={showDescEmoji ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
                    </button>
                    {showDescEmoji && (
                      <div style={{ position: 'absolute', bottom: '50px', left: 0, zIndex: 20 }}>
                        <EmojiPicker
                          onEmojiClick={(emojiObject: any) => {
                            setInputDescription(prev => prev + emojiObject.emoji);
                            setShowDescEmoji(false);
                          }}
                          width={300}
                          height={400}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <button className="premium-button confirm-btn" onClick={() => setShowDetailModal(false)}>
                  완료 ({pendingImages.length}장)
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Image Viewer */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fullscreen-image-overlay"
            onClick={() => setFullscreenImage(null)}
          >
            <div className="fullscreen-image-wrapper">
              <img src={fullscreenImage} alt="Full View" />
              <button className="close-fullscreen-btn" onClick={() => setFullscreenImage(null)}>
                <X size={32} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* OCR Result Modal (Existing) */}


      <style>{`
        .app-container { padding: 20px; position: relative; z-index: 1; max-width: 800px; margin: 0 auto; width: 100%; transition: max-width 0.3s; }
        @media (max-width: 768px) { .app-container { padding: 16px; } }
        
        /* Updated Background Shapes */
        .bg-shape { position: fixed; border-radius: 50%; filter: blur(100px); z-index: -1; opacity: 0.6; }
        .bg-shape-1 { width: 400px; height: 400px; background: var(--accent-primary); top: -100px; right: -150px; }
        .bg-shape-2 { width: 350px; height: 350px; background: var(--accent-secondary); bottom: -50px; left: -100px; }

        header { margin-bottom: 24px; }
        .header-content { display: flex; align-items: center; justify-content: space-between; }
        header h1 { font-size: 28px; font-weight: 800; color: var(--text-primary); margin-bottom: 4px; }
        .current-date-display { font-size: 14px; color: var(--text-secondary); display: flex; gap: 8px; align-items: center; }
        .date-context { font-size: 11px; padding: 4px 10px; border-radius: 20px; font-weight: 700; }
        .date-context.past { background: #ffeaa7; color: #d35400; }
        .date-context.future { background: #74c0fc; color: #1864ab; }
        .date-context.current { background: #a29bfe; color: #4834d4; }

        .view-toggle-btn { background: white; border: none; padding: 10px; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); color: var(--text-primary); cursor: pointer; transition: all 0.2s; }
        .view-toggle-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.1); }
        .view-toggle-btn.active { background: var(--accent-primary); color: white; }

        /* Tabs Styling for Bright Theme */
        .tabs { display: flex; padding: 8px; gap: 8px; margin-bottom: 24px; background: rgba(255, 255, 255, 0.8); }
        .tabs button { flex: 1; background: transparent; border: none; color: var(--text-secondary); padding: 12px; border-radius: 12px; font-size: 14px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; }
        .tabs button:hover { background: rgba(0,0,0,0.03); }
        .tabs button.active { background: white; color: var(--accent-primary); box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
        .badge { background: var(--accent-primary); color: white; font-size: 11px; padding: 2px 6px; border-radius: 10px; }

        /* Input Group - Now a bit more spacious */
        .input-group { padding: 16px; background: rgba(255, 255, 255, 0.9); margin-bottom: 24px; display: flex; gap: 12px; align-items: flex-start; }
        .input-fields { flex: 1; display: flex; flex-direction: column; gap: 12px; }
        
        .input-row { 
            display: flex; 
            align-items: center; 
            gap: 12px; 
            background: rgba(255, 255, 255, 0.6); 
            border: 1px solid rgba(255, 255, 255, 0.4); 
            border-radius: 16px; 
            padding: 10px 14px; 
            transition: all 0.2s;
            box-shadow: 0 2px 8px rgba(0,0,0,0.02);
            margin-bottom: 0;
        }
        .input-row:focus-within {
            background: rgba(255, 255, 255, 0.9);
            border-color: var(--accent-secondary);
            box-shadow: 0 4px 12px rgba(78, 205, 196, 0.2);
            transform: translateY(-1px);
        }
        
        .title-input { flex: 1; background: transparent; border: none; font-size: 1.1rem; font-weight: 700; color: var(--text-primary); outline: none; }
        .title-input::placeholder { color: #a0a0a0; }
        
        .desc-row { align-items: flex-start; }
        .desc-textarea { flex: 1; min-height: 24px; background: transparent; border: none; resize: none; color: var(--text-secondary); font-size: 0.95rem; line-height: 1.5; outline: none; overflow: hidden; padding: 4px 0; font-family: inherit; }
        
        .action-grid { 
            display: grid; 
            grid-template-columns: 32px 32px; 
            gap: 8px; 
            align-items: center;
        }
        
        .icon-btn { width: 32px; height: 32px; border-radius: 8px; color: var(--text-secondary); background: transparent; display: flex; align-items: center; justify-content: center; }
        .icon-btn:hover { background: rgba(0,0,0,0.05); color: var(--accent-primary); }
        .listening { color: #ff6b6b; animation: pulse 1.5s infinite; }

        .add-btn { width: 50px; height: 50px; flex-shrink: 0; margin-top: 4px; }

        /* Todo Item Styling */
        /* Updated Todo Item Styling for Top-Right Actions */
        /* Updated Todo Item Styling for Top-Right Actions */
        /* Updated Todo Item Styling for Top-Right Actions */
        .todo-item { 
          background: rgba(255, 255, 255, 0.95); 
          padding: 16px; 
          border: 1px solid rgba(255,255,255,0.6); 
          box-shadow: 0 4px 6px rgba(0,0,0,0.02); 
          position: relative;
          display: flex;
          flex-direction: column; /* Stack header and content */
          gap: 12px;
        }

        .todo-header-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
        }
        
        .todo-header-left {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .todo-content { 
            width: 100%; 
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .todo-title { color: var(--text-primary); font-size: 1rem; font-weight: 700; width: 100%; line-height: 1.4; }
        .todo-desc { color: var(--text-secondary); font-size: 0.95rem; line-height: 1.5; word-break: break-word; white-space: pre-wrap; width: 100%; }

        .todo-date-badge { font-size: 0.9rem; color: #d35400; background: #ffeaa7; padding: 2px 6px; border-radius: 6px; font-weight: 700; display: inline-flex;  }
        
        .check-btn { color: #cbd5e1; transition: color 0.2s; background: transparent; border: none; padding: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; }
        
        /* Edit Mode Styles */
        .edit-container { position: relative; display: flex; flex-direction: column; gap: 8px; }
        .edit-actions { display: flex; gap: 4px; justify-content: flex-end; }
        .save-btn, .cancel-btn { width: 32px; height: 32px; border-radius: 50%; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; }
        .save-btn { background: var(--accent-secondary); color: white; }
        .cancel-btn { background: #f1f3f5; color: var(--text-secondary); }
        .edit-title { font-size: 1rem; font-weight: 700; padding: 8px; border: 1px solid var(--glass-border); border-radius: 8px; background: rgba(255,255,255,0.5); width: 100%; }
        .edit-desc { font-size: 0.9rem; padding: 8px; border: 1px solid var(--glass-border); border-radius: 8px; background: rgba(255,255,255,0.5); width: 100%; }

        .todo-multimedia { margin-top: 12px; }
        .todo-image-container { position: relative; border-radius: 12px; overflow: hidden; max-width: 100%; display: inline-block; }
        .todo-image { max-width: 100%; height: auto; display: block; object-fit: contain; max-height: 400px; }
        .remove-saved-img { position: absolute; top: 6px; right: 6px; background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; cursor: pointer; }



        
        .item-actions { position: absolute; top: 12px; right: 12px; display: flex; gap: 8px; }
        .item-actions button { color: #b2bec3; background: transparent; border: none; padding: 4px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: color 0.2s; }
        .item-actions button:hover { color: var(--accent-primary); background: transparent; }

        /* Edit Styles Enhancements */
        .edit-title { font-size: 1rem; font-weight: 700; padding: 8px; border: none; background: transparent; width: 100%; outline: none; }
        .edit-title:focus { background: rgba(0,0,0,0.02); border-radius: 8px; }
        .edit-desc { font-size: 0.9rem; padding: 8px; border: none; background: transparent; width: 100%; resize: none; font-family: inherit; outline: none; }
        .edit-desc:focus { background: rgba(0,0,0,0.02); border-radius: 8px; }

        .edit-separator { height: 1px; background: #e2e8f0; margin: 4px 8px; width: calc(100% - 16px); }

        /* Styled Toolbar Buttons (The User's Image Style) */
        .edit-tools-bar { display: flex; gap: 10px; padding: 0 8px; margin-top: 8px; }
        .edit-tool-btn { 
            width: 42px; height: 42px; 
            border: 2px solid #cbd5e1; /* Slate-300 */
            border-radius: 12px; 
            background: white; 
            display: flex; align-items: center; justify-content: center; 
            cursor: pointer; 
            color: #64748b; /* Slate-500 */
            transition: all 0.2s;
        }
        .edit-tool-btn:hover { border-color: var(--accent-primary); color: var(--accent-primary); background: #f8f9fa; transform: translateY(-1px); }
        
        /* Thumbnails */
        .edit-images-section { margin: 12px 0 4px 0; padding: 0 8px; }
        .images-list { display: flex; gap: 8px; flex-wrap: wrap; }
        .edit-image-thumbnail { position: relative; width: 60px; height: 60px; border-radius: 10px; overflow: hidden; border: 1px solid rgba(0,0,0,0.1); box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .edit-image-thumbnail img { width: 100%; height: 100%; object-fit: cover; }
        .remove-edit-img { position: absolute; top: 2px; right: 2px; background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; cursor: pointer; padding: 0; }
        
        /* View Images Grid */
        /* View Images - Horizontal Slide Scroll */
        .images-grid { 
            display: flex; 
            gap: 12px; 
            overflow-x: auto; 
            padding-bottom: 8px; /* For scrollbar space */
            flex-wrap: nowrap; /* Prevent wrapping */
            -webkit-overflow-scrolling: touch; /* Smooth scroll on mobile */
        }
        .images-grid::-webkit-scrollbar { height: 6px; }
        .images-grid::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .images-grid .todo-image-container { 
            flex: 0 0 auto; /* Don't shrink */
            width: 150px; 
            height: 150px; 
            border-radius: 12px; 
            overflow: hidden; 
            border: 1px solid rgba(0,0,0,0.05);
            transition: transform 0.1s, opacity 0.1s;
            -webkit-tap-highlight-color: transparent;
        }
        .images-grid .todo-image-container:active {
            transform: scale(0.98);
            opacity: 0.8;
        }
        .images-grid .todo-image { 
            width: 100%; 
            height: 100%; 
            object-fit: cover; 
        }
        
        .empty-state .glass-card {
            padding: 40px;
            text-align: center;
            color: var(--text-secondary);
            font-weight: 500;
            display: flex;
            justify-content: center;
            align-items: center;
        }

        /* Overlays */
        .ocr-loader-overlay { background: rgba(0,0,0,0.2); backdrop-filter: blur(8px); }
        .ocr-loader-content { background: white; color: var(--text-primary); box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
        
        /* Responsive Fixes */
        .app-container {
             width: 100%;
        }

        /* Detail Modal Styles */
        .modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(4px);
            z-index: 9999; /* Ensure it's on top of everything */
            display: flex; align-items: center; justify-content: center;
            padding: 20px;
        }
        .modal-content {
            background: rgba(255, 255, 255, 0.95);
            width: 100%; max-width: 500px;
            border-radius: 24px; padding: 24px;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
            border: 1px solid rgba(255, 255, 255, 0.5);
            display: flex; flex-direction: column; gap: 16px;
        }
        .modal-content h3 { font-size: 1.2rem; font-weight: 700; color: var(--text-primary); margin-bottom: 4px; }
        .modal-textarea {
            width: 100%; min-height: 200px;
            background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 16px;
            padding: 16px; font-size: 1rem; line-height: 1.6;
            resize: none; outline: none; appearance: none;
            color: var(--text-primary);
        }
        .modal-textarea:focus { border-color: var(--accent-secondary); background: white; }
        
        .modal-actions-row { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
        .left-actions { display: flex; gap: 8px; }
        
        .confirm-btn { padding: 8px 32px; font-size: 1rem; }
        
        .modal-images-scroll-container {
            display: flex;
            gap: 12px;
            overflow-x: auto;
            padding-bottom: 8px;
            margin-bottom: 8px;
            flex-wrap: nowrap;
        }
        .modal-images-scroll-container::-webkit-scrollbar { height: 6px; }
        .modal-images-scroll-container::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }

        .modal-image-preview {
            position: relative; 
            flex: 0 0 200px; /* Fixed width for previews */
            height: 200px; 
            border-radius: 12px; 
            overflow: hidden;
            border: 1px solid rgba(0,0,0,0.05); 
            background: #f8f9fa;
        }
        .modal-image-preview img { width: 100%; height: 100%; object-fit: cover; }
        .remove-img-btn {
            position: absolute; top: 8px; right: 8px;
            width: 28px; height: 28px; background: rgba(0,0,0,0.6);
            border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; border: none; cursor: pointer;
            z-index: 10;
        }
        .scan-text-btn {
            position: absolute; bottom: 10px; right: 10px;
            padding: 8px 16px; background: rgba(255,255,255,0.9);
            border-radius: 20px; color: var(--accent-primary);
            font-size: 13px; font-weight: 600;
            display: flex; align-items: center; gap: 6px;
            border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            z-index: 10;
        }
        
        .todo-list {
            position: relative;
            z-index: 1; /* Lower than modal */
            display: flex;
            flex-direction: column;
            gap: 20px;
        }
          
        /* Fullscreen Viewer Styles */
        .fullscreen-image-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0, 0, 0, 0.9);
            z-index: 10000;
            display: flex; align-items: center; justify-content: center;
            padding: 20px;
        }
        .fullscreen-image-wrapper { position: relative; max-width: 100%; max-height: 100%; display: flex; justify-content: center; align-items: center; }
        .fullscreen-image-wrapper img { max-width: 100%; max-height: 90vh; object-fit: contain; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
        .close-fullscreen-btn {
            position: absolute; top: -40px; right: -40px;
            background: rgba(255,255,255,0.2); color: white;
            border: none; border-radius: 50%; width: 40px; height: 40px;
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; transition: background 0.2s;
        }
        .close-fullscreen-btn:hover { background: rgba(255,255,255,0.4); }
        @media (max-width: 768px) {
            .close-fullscreen-btn { top: -40px; right: 0; } /* Adjust for mobile */
        }

        @media (max-width: 768px) {
            .close-fullscreen-btn { top: -40px; right: 0; } /* Adjust for mobile */
        }

      `}</style>
    </div>
  );
}
