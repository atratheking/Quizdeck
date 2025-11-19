import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Library, 
  Brain, 
  Layers, 
  Gamepad2, 
  ChevronLeft, 
  ChevronRight, 
  RotateCw, 
  X, 
  Check, 
  Trophy,
  Trash2,
  Save,
  ArrowLeft,
  Play,
  Settings,
  Sparkles,
  Bot,
  Send,
  FileText,
  Loader2,
  MessageCircle,
  Upload,
  Image as ImageIcon,
  Moon,
  Sun,
  File as FileIcon,
  Key,
  AlertCircle
} from 'lucide-react';

// --- Tailwind CSS is assumed to be available ---

/**
 * API UTILITIES
 */
const apiKey = import.meta.env.VITE_GEMINI_KEY ||"";

const getEffectiveApiKey = () => {
  return localStorage.getItem('quizdeck_api_key') || apiKey;
};

const generateFlashcardsAI = async (text, fileBase64 = null, mimeType = null) => {
  const key = getEffectiveApiKey();
  if (!key) {
    throw new Error("API Key is missing. Please add your Google Gemini API Key in the Settings (gear icon).");
  }

  try {
    const parts = [{
      text: `You are an expert teacher. Analyze the ${fileBase64 ? "document/image" : "text"} provided and create a study set of flashcards. 
              
              Instructions:
              1. If a document is provided, extract the key concepts, definitions, and terms from it.
              2. Create a structured study set based on this analysis.
              3. Return ONLY valid JSON (no markdown formatting, no code blocks) with this exact structure:
              {
                "title": "Short descriptive title",
                "description": "Brief summary of the content",
                "cards": [
                  {"term": "Key Term", "def": "Clear, concise definition"}
                ]
              }
              Create at least 5-10 cards if the content allows.
              
              ${text ? `Additional User Instructions:\n${text}` : ''}`
    }];

    if (fileBase64) {
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: fileBase64
        }
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: "application/json"
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401) {
         throw new Error("Invalid API Key. Please check your key in Settings.");
      }
      if (response.status === 400 && errorText.includes("MIME type")) {
         throw new Error("The AI model does not support this file type. Please convert to PDF or Image.");
      }
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (!data.candidates || !data.candidates[0]) throw new Error("AI could not process this file.");
    
    let content = data.candidates[0].content.parts[0].text;
    
    // Sanitize: Remove markdown code blocks if present
    content = content.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(content);
  } catch (error) {
    console.error("AI Generation Error:", error);
    throw new Error(error.message || "Failed to generate flashcards.");
  }
};

const chatWithAI = async (message, contextSet, history) => {
  const key = getEffectiveApiKey();
  if (!key) return "Please set your API Key in Settings to use the AI Tutor.";

  try {
    // Construct context from the current set
    const setContext = contextSet 
      ? `Current Study Set: "${contextSet.title}". Content: ${contextSet.cards.map(c => `${c.term}: ${c.def}`).join('; ')}.`
      : "No specific study set selected.";

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `You are a helpful study tutor named QuizBot. 
              Context: ${setContext}
              User Question: ${message}
              
              Answer the user's question. If they ask about the current set, use the provided content. 
              Keep answers concise (under 3 sentences) and encouraging.`
            }]
          }]
        })
      }
    );

    if (!response.ok) {
       if (response.status === 401) return "Error: Invalid API Key. Please check Settings.";
       return "I'm having trouble reaching the server right now. Please try again later.";
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error("Chat Error:", error);
    return "Sorry, I'm having trouble connecting to my brain right now.";
  }
};

/**
 * UTILITIES
 */
const shuffleArray = (array) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

const generateId = () => Math.random().toString(36).substr(2, 9);

// Mock Initial Data
const INITIAL_SETS = [
  {
    id: '1',
    title: 'Biology 101: The Cell',
    description: 'Basic structure and function of cells',
    cards: [
      { id: 'c1', term: 'Mitochondria', def: 'The powerhouse of the cell; generates ATP.' },
      { id: 'c2', term: 'Nucleus', def: 'Contains the cell\'s genetic material (DNA).' },
      { id: 'c3', term: 'Ribosome', def: ' The site of protein synthesis.' },
      { id: 'c4', term: 'Mitosis', def: 'Process of cell division resulting in two identical daughter cells.' },
      { id: 'c5', term: 'Osmosis', def: 'Movement of water molecules through a semi-permeable membrane.' },
      { id: 'c6', term: 'Chloroplast', def: 'Organelle where photosynthesis occurs in plant cells.' }
    ]
  }
];

/**
 * SUB-COMPONENTS
 */

// 1. SETTINGS MODAL
const SettingsModal = ({ isOpen, onClose, darkMode }) => {
  const [key, setKey] = useState(localStorage.getItem('quizdeck_api_key') || '');
  
  const handleSave = () => {
    localStorage.setItem('quizdeck_api_key', key.trim());
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className={`w-full max-w-md rounded-3xl shadow-2xl p-8 animate-in zoom-in-95 duration-200 ${darkMode ? 'bg-[#1c1c1e] text-white border border-gray-800' : 'bg-white text-gray-900'}`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2 tracking-tight">
            <Settings className="text-indigo-500" /> Settings
          </h2>
          <button onClick={onClose} className={`p-2 rounded-full transition ${darkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'}`}>
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4 mb-8">
          <div>
            <label className={`block text-sm font-semibold mb-2 ml-1 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>Google Gemini API Key</label>
            <div className={`flex items-center rounded-2xl px-4 py-3 transition-all ${darkMode ? 'bg-[#2c2c2e] focus-within:bg-[#3a3a3c]' : 'bg-gray-100 focus-within:bg-gray-50 focus-within:ring-2 focus-within:ring-indigo-500/20'}`}>
              <Key size={18} className="text-gray-400 mr-3" />
              <input 
                type="password" 
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="Enter your API Key"
                className="bg-transparent border-none outline-none flex-1 text-sm"
              />
            </div>
            <p className="text-xs text-gray-500 mt-3 ml-1">
              Required for AI features. Your key is stored locally in your browser.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button 
            onClick={handleSave}
            className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-full hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-500/30"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

// 2. CHAT WIDGET COMPONENT
const ChatWidget = ({ activeSet, darkMode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hi! I can help you study this set. Ask me to quiz you or explain a term!' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg = { role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    const aiResponseText = await chatWithAI(input, activeSet, messages);
    
    setMessages(prev => [...prev, { role: 'ai', text: aiResponseText }]);
    setIsLoading(false);
  };

  if (!activeSet && !isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
      {/* Chat Window */}
      {isOpen && (
        <div className={`mb-4 w-80 md:w-96 h-[500px] rounded-3xl shadow-2xl border flex flex-col overflow-hidden pointer-events-auto animate-in slide-in-from-bottom-10 fade-in duration-300 ${darkMode ? 'bg-[#1c1c1e] border-gray-800' : 'bg-white/90 backdrop-blur-xl border-gray-200/50'}`}>
          {/* Header */}
          <div className={`p-4 flex justify-between items-center border-b ${darkMode ? 'bg-[#2c2c2e] border-gray-800' : 'bg-white/50 border-gray-100'}`}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-md">
                 <Bot size={16} />
              </div>
              <div>
                <h3 className={`font-bold text-sm ${darkMode ? 'text-white' : 'text-gray-900'}`}>AI Tutor</h3>
                <p className="text-xs text-green-500 font-medium">Online</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className={`p-2 rounded-full transition ${darkMode ? 'hover:bg-gray-700 text-gray-400' : 'hover:bg-gray-100 text-gray-500'}`}>
              <X size={18} />
            </button>
          </div>
          
          {/* Messages */}
          <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${darkMode ? 'bg-[#1c1c1e]' : 'bg-gray-50/50'}`}>
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-sm' 
                    : darkMode 
                      ? 'bg-[#2c2c2e] text-gray-200 rounded-tl-sm' 
                      : 'bg-white text-gray-700 rounded-tl-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className={`px-4 py-3 rounded-2xl rounded-tl-sm shadow-sm ${darkMode ? 'bg-[#2c2c2e]' : 'bg-white'}`}>
                  <Loader2 size={16} className="animate-spin text-indigo-600" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className={`p-4 border-t ${darkMode ? 'bg-[#2c2c2e] border-gray-800' : 'bg-white/80 border-gray-100'}`}>
            <div className={`flex items-center rounded-full px-2 py-2 ${darkMode ? 'bg-[#1c1c1e]' : 'bg-gray-100'}`}>
                <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask a question..."
                className={`flex-1 bg-transparent border-none outline-none px-4 text-sm ${darkMode ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'}`}
                />
                <button 
                onClick={handleSend} 
                disabled={isLoading || !input.trim()}
                className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-sm active:scale-95"
                >
                <Send size={16} />
                </button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="pointer-events-auto p-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-full shadow-xl shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all duration-300 flex items-center gap-2 group z-50"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
        {!isOpen && <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 whitespace-nowrap font-semibold">Ask AI</span>}
      </button>
    </div>
  );
};

// 3. AI GENERATOR COMPONENT
const AIGenerator = ({ onSave, onCancel, darkMode }) => {
  const [text, setText] = useState('');
  const [file, setFile] = useState(null); // { base64, mimeType, preview, name, type }
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    // Helper for Word docs
    if (selectedFile.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        setError("Word docs (.docx) aren't supported directly. Please 'Save as PDF' and upload that for best results!");
        return;
    }

    // Allowed types: Images, PDF
    const allowedTypes = [
      'image/png', 'image/jpeg', 'image/webp', 'image/heic',
      'application/pdf'
    ];

    if (!allowedTypes.includes(selectedFile.type)) {
      setError("Unsupported file type. Please upload an Image or PDF.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      // result is like "data:application/pdf;base64,......"
      const base64String = reader.result.split(',')[1];
      setFile({
        base64: base64String,
        mimeType: selectedFile.type,
        preview: selectedFile.type.startsWith('image/') ? reader.result : null,
        name: selectedFile.name,
        type: selectedFile.type
      });
      setError(null);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerate = async () => {
    if ((!text.trim() || text.length < 10) && !file) {
      setError("Please enter text or upload a document to analyze.");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateFlashcardsAI(text, file?.base64, file?.mimeType);
      // Add IDs to the generated cards
      const processedCards = result.cards.map(c => ({ ...c, id: generateId() }));
      
      onSave({
        id: generateId(),
        title: result.title || "AI Generated Set",
        description: result.description || "Created from your notes",
        cards: processedCards
      });
    } catch (err) {
      setError(err.message);
      setIsGenerating(false);
    }
  };

  const bgClass = darkMode ? 'bg-[#1c1c1e] border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-900';
  const textClass = darkMode ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className="max-w-3xl mx-auto p-4 h-full flex flex-col animate-in fade-in duration-500">
      <div className="mb-8">
        <button onClick={onCancel} className={`${textClass} hover:text-indigo-500 font-semibold flex items-center mb-6 transition-colors`}>
          <ArrowLeft size={18} className="mr-2" /> Back
        </button>
        <div className="flex items-center gap-4 mb-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-purple-500/20">
            <Sparkles size={24} />
          </div>
          <h1 className={`text-3xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>Magic Generator</h1>
        </div>
        <p className={`text-lg leading-relaxed ${textClass}`}>Paste your notes, or upload a PDF or Image. Our AI will scan it to build your deck instantly.</p>
      </div>

      <div className="flex-1 flex flex-col gap-6 mb-8 relative">
        {/* File Upload Section */}
        <input 
          type="file" 
          accept="image/*,application/pdf,.docx" 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        
        {file ? (
          <div className={`relative w-full h-48 rounded-3xl border overflow-hidden group transition-all ${darkMode ? 'bg-[#2c2c2e] border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
            {file.preview ? (
              <img src={file.preview} alt="Upload preview" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-500">
                <FileIcon size={48} className="mb-3 text-indigo-500" />
                <span className="font-bold text-lg">{file.name}</span>
                <span className="text-xs uppercase mt-2 bg-gray-200/50 px-3 py-1 rounded-full text-gray-600 font-medium tracking-wide">{file.type.split('/')[1] || 'DOC'}</span>
              </div>
            )}
            
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center gap-4">
               <button onClick={() => fileInputRef.current?.click()} className="px-5 py-2 bg-white/90 text-gray-900 rounded-full font-bold text-sm hover:bg-white hover:scale-105 transition-all">Change</button>
               <button onClick={handleRemoveFile} className="px-5 py-2 bg-red-500/90 text-white rounded-full font-bold text-sm hover:bg-red-600 hover:scale-105 transition-all">Remove</button>
            </div>
            <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white text-xs px-3 py-1.5 rounded-full flex items-center font-medium">
               {file.preview ? <ImageIcon size={12} className="mr-2" /> : <FileText size={12} className="mr-2" />} {file.name}
            </div>
          </div>
        ) : (
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isGenerating}
            className={`w-full h-32 border-2 border-dashed rounded-3xl flex flex-col items-center justify-center transition-all duration-300 group ${darkMode ? 'bg-[#1c1c1e] border-gray-700 text-gray-400 hover:border-indigo-500 hover:bg-[#2c2c2e]' : 'bg-gray-50 border-gray-300 text-gray-400 hover:border-indigo-500 hover:bg-indigo-50/30'}`}
          >
            <div className={`p-3 rounded-full mb-3 transition-colors ${darkMode ? 'bg-[#2c2c2e] group-hover:text-white' : 'bg-white group-hover:text-indigo-600 text-gray-400'}`}>
               <Upload size={24} />
            </div>
            <span className="font-semibold text-sm">Click to upload PDF (or converted Word doc)</span>
          </button>
        )}

        {/* Text Area */}
        <div className={`flex-1 rounded-3xl shadow-sm border p-1 flex flex-col relative overflow-hidden transition-all ${bgClass} ${darkMode ? 'focus-within:border-gray-600' : 'focus-within:border-indigo-300 focus-within:ring-4 focus-within:ring-indigo-100'}`}>
          <textarea 
            className={`flex-1 w-full h-full resize-none outline-none leading-relaxed p-5 rounded-2xl bg-transparent ${darkMode ? 'text-gray-100 placeholder-gray-600' : 'text-gray-800 placeholder-gray-400'}`}
            placeholder="Or paste your text here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isGenerating}
          />
          {isGenerating && (
            <div className={`absolute inset-0 backdrop-blur-md flex flex-col items-center justify-center z-10 ${darkMode ? 'bg-black/60' : 'bg-white/60'}`}>
              <div className="relative">
                 <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
                 <Loader2 size={48} className="text-indigo-600 animate-spin mb-6 relative z-10" />
              </div>
              <p className="text-indigo-600 font-bold animate-pulse tracking-wide text-lg">
                {file ? "Scanning document..." : "Analyzing text..."}
              </p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-600 rounded-2xl text-sm flex items-center animate-in slide-in-from-bottom-2 font-medium">
          <AlertCircle size={18} className="mr-3 flex-shrink-0" /> 
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end gap-4">
        <button 
          onClick={onCancel}
          disabled={isGenerating}
          className={`px-8 py-3.5 font-semibold rounded-full transition-all ${darkMode ? 'text-gray-300 hover:bg-[#2c2c2e]' : 'text-gray-600 hover:bg-gray-100'}`}
        >
          Cancel
        </button>
        <button 
          onClick={handleGenerate}
          disabled={isGenerating || (!text.trim() && !file)}
          className="px-8 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-full shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100 disabled:shadow-none flex items-center"
        >
          {isGenerating ? 'Generating...' : <><Sparkles size={18} className="mr-2" /> Generate Set</>}
        </button>
      </div>
    </div>
  );
};

// 4. FLASHCARD COMPONENT
const FlashcardMode = ({ set, onBack, darkMode }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const nextCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % set.cards.length);
    }, 150);
  };

  const prevCard = () => {
    setIsFlipped(false);
    setTimeout(() => {
      setCurrentIndex((prev) => (prev - 1 + set.cards.length) % set.cards.length);
    }, 150);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') nextCard();
      if (e.key === 'ArrowLeft') prevCard();
      if (e.key === ' ' || e.key === 'Enter') setIsFlipped(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [set.cards.length]);

  const currentCard = set.cards[currentIndex];
  const progress = ((currentIndex + 1) / set.cards.length) * 100;

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto p-4">
      <div className="mb-8 flex items-center justify-between">
        <button onClick={onBack} className={`flex items-center font-semibold transition-colors ${darkMode ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-900'}`}>
          <ArrowLeft size={20} className="mr-2" /> Back to Set
        </button>
        <span className={`text-sm font-bold tracking-wide px-3 py-1 rounded-full ${darkMode ? 'bg-[#2c2c2e] text-gray-300' : 'bg-gray-100 text-gray-500'}`}>{currentIndex + 1} / {set.cards.length}</span>
      </div>

      {/* Card Container */}
      <div className="flex-1 flex flex-col justify-center items-center min-h-[400px] perspective-1000">
        <div 
          className={`relative w-full h-96 cursor-pointer transition-all duration-500 transform-style-3d ${isFlipped ? 'rotate-y-180' : ''}`}
          onClick={() => setIsFlipped(!isFlipped)}
        >
          {/* Front */}
          <div className={`absolute inset-0 rounded-3xl shadow-xl border flex flex-col items-center justify-center p-10 backface-hidden ${darkMode ? 'bg-[#1c1c1e] border-gray-800 text-white' : 'bg-white border-gray-100 text-gray-900'}`}>
            <span className={`text-xs font-bold uppercase tracking-widest absolute top-8 left-8 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Term</span>
            <h2 className="text-3xl md:text-5xl text-center font-bold tracking-tight leading-tight">{currentCard.term}</h2>
            <span className={`text-sm font-medium absolute bottom-8 text-center w-full opacity-50 ${darkMode ? 'text-gray-400' : 'text-gray-400'}`}>Tap to flip</span>
          </div>

          {/* Back */}
          <div className={`absolute inset-0 rounded-3xl shadow-xl border flex flex-col items-center justify-center p-10 backface-hidden rotate-y-180 ${darkMode ? 'bg-[#2c2c2e] border-gray-700 text-white' : 'bg-gradient-to-br from-indigo-50 to-white border-indigo-100 text-indigo-900'}`}>
            <span className={`text-xs font-bold uppercase tracking-widest absolute top-8 left-8 ${darkMode ? 'text-gray-400' : 'text-indigo-400'}`}>Definition</span>
            <p className="text-2xl md:text-3xl text-center font-medium leading-relaxed">{currentCard.def}</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-8 mt-12">
          {[
            { icon: ChevronLeft, action: prevCard },
            { icon: RotateCw, action: () => setIsFlipped(!isFlipped) },
            { icon: ChevronRight, action: nextCard }
          ].map((btn, i) => (
            <button 
              key={i} 
              onClick={btn.action} 
              className={`p-5 rounded-full transition-all active:scale-95 ${darkMode ? 'bg-[#2c2c2e] text-white hover:bg-[#3a3a3c] shadow-lg shadow-black/20' : 'bg-white text-gray-600 hover:text-indigo-600 hover:shadow-xl shadow-lg shadow-gray-200/50'}`}
            >
              <btn.icon size={24} strokeWidth={2.5} />
            </button>
          ))}
        </div>
      </div>

      {/* Progress Bar */}
      <div className={`mt-12 h-1.5 rounded-full overflow-hidden ${darkMode ? 'bg-[#2c2c2e]' : 'bg-gray-100'}`}>
        <div className="h-full bg-indigo-500 transition-all duration-300 rounded-full" style={{ width: `${progress}%` }}></div>
      </div>
    </div>
  );
};

// 5. MATCH GAME COMPONENT
const MatchMode = ({ set, onBack, darkMode }) => {
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [matchedIds, setMatchedIds] = useState([]);
  const [startTime] = useState(Date.now());
  const [currentTime, setCurrentTime] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [wrongPair, setWrongPair] = useState([]);

  // Initialize Game
  useEffect(() => {
    const gameItems = set.cards.flatMap(card => [
      { id: `${card.id}-term`, content: card.term, type: 'term', parentId: card.id },
      { id: `${card.id}-def`, content: card.def, type: 'def', parentId: card.id }
    ]);
    setItems(shuffleArray(gameItems));
    
    const timer = setInterval(() => {
      if (!isGameOver) setCurrentTime((Date.now() - startTime) / 1000);
    }, 100);
    return () => clearInterval(timer);
  }, [set, isGameOver, startTime]);

  useEffect(() => {
    if (matchedIds.length === items.length && items.length > 0) {
      setIsGameOver(true);
    }
  }, [matchedIds, items]);

  const handleCardClick = (item) => {
    if (matchedIds.includes(item.id) || selectedIds.includes(item.id) || isGameOver || wrongPair.length > 0) return;

    const newSelected = [...selectedIds, item.id];
    setSelectedIds(newSelected);

    if (newSelected.length === 2) {
      const [firstId, secondId] = newSelected;
      const firstItem = items.find(i => i.id === firstId);
      const secondItem = items.find(i => i.id === secondId);

      if (firstItem.parentId === secondItem.parentId) {
        setMatchedIds(prev => [...prev, firstId, secondId]);
        setSelectedIds([]);
      } else {
        setWrongPair([firstId, secondId]);
        setTimeout(() => {
          setWrongPair([]);
          setSelectedIds([]);
        }, 800);
      }
    }
  };

  if (isGameOver) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 animate-in zoom-in-95 duration-500">
        <div className="mb-8 relative">
            <div className="absolute inset-0 bg-yellow-500 blur-3xl opacity-20 rounded-full"></div>
            <Trophy size={80} className="text-yellow-500 relative z-10 drop-shadow-lg" />
        </div>
        <h2 className={`text-5xl font-bold mb-4 tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>Great Job!</h2>
        <p className={`text-2xl mb-12 font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>You cleared the deck in <span className="font-bold text-indigo-500">{currentTime.toFixed(1)}s</span></p>
        <div className="flex gap-4">
          <button onClick={() => window.location.reload()} className="px-8 py-4 bg-indigo-600 text-white rounded-full font-bold hover:bg-indigo-700 hover:shadow-lg hover:scale-105 active:scale-95 transition-all">Play Again</button>
          <button onClick={onBack} className={`px-8 py-4 rounded-full font-bold transition-all hover:scale-105 active:scale-95 ${darkMode ? 'bg-[#2c2c2e] text-white hover:bg-[#3a3a3c]' : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}>Back to Set</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-4">
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className={`flex items-center font-semibold transition-colors ${darkMode ? 'text-gray-400 hover:text-indigo-400' : 'text-gray-600 hover:text-indigo-600'}`}>
           <X size={20} className="mr-2" /> End Game
        </button>
        <div className="text-2xl font-mono font-bold text-indigo-500 bg-indigo-500/10 px-4 py-1 rounded-lg">{currentTime.toFixed(1)}s</div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 flex-1 content-start">
        {items.map(item => {
          const isSelected = selectedIds.includes(item.id);
          const isMatched = matchedIds.includes(item.id);
          const isWrong = wrongPair.includes(item.id);

          if (isMatched) return <div key={item.id} className="invisible"></div>;

          // Card Base Styles
          let cardStyle = darkMode 
            ? 'bg-[#1c1c1e] border-gray-800 text-gray-200' 
            : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300';

          if (isSelected) {
             cardStyle = darkMode 
              ? 'border-indigo-500 bg-[#2c2c2e] text-white scale-105 shadow-lg shadow-indigo-500/20' 
              : 'border-indigo-500 bg-indigo-50 text-indigo-900 scale-105 shadow-lg shadow-indigo-200/50';
          }
          if (isWrong) {
             cardStyle = darkMode 
              ? 'animate-shake border-red-500 bg-red-900/20 text-red-400' 
              : 'animate-shake border-red-500 bg-red-50 text-red-600';
          }

          return (
            <div
              key={item.id}
              onClick={() => handleCardClick(item)}
              className={`min-h-[120px] p-6 rounded-2xl flex items-center justify-center text-center cursor-pointer transition-all duration-200 shadow-sm border-2 font-semibold text-lg select-none ${cardStyle}`}
            >
              {item.content}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 6. LEARN MODE COMPONENT
const LearnMode = ({ set, onBack, darkMode }) => {
  const [queue, setQueue] = useState([]);
  const [currentQ, setCurrentQ] = useState(null);
  const [options, setOptions] = useState([]);
  const [selectedOption, setSelectedOption] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [score, setScore] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    setQueue(shuffleArray([...set.cards]));
  }, [set]);

  useEffect(() => {
    if (queue.length > 0 && !currentQ) {
      const nextCard = queue[0];
      setCurrentQ(nextCard);
      
      const distractors = shuffleArray(set.cards.filter(c => c.id !== nextCard.id)).slice(0, 3);
      const allOptions = shuffleArray([nextCard, ...distractors]);
      setOptions(allOptions);
      setSelectedOption(null);
      setIsCorrect(null);
    } else if (queue.length <= 0 && currentQ === null && !completed) {
      // Handled by queue check in render
    }
  }, [queue, currentQ, set.cards, completed]);

  const handleAnswer = (option) => {
    if (selectedOption) return;
    setSelectedOption(option);
    
    if (option.id === currentQ.id) {
      setIsCorrect(true);
      setScore(s => s + 1);
    } else {
      setIsCorrect(false);
    }
  };

  const handleNext = () => {
    if (queue.length <= 1) {
      setCompleted(true);
    } else {
      setQueue(prev => prev.slice(1));
      setCurrentQ(null);
    }
  };

  if (completed) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 animate-in zoom-in-95">
        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 text-green-600 shadow-lg shadow-green-500/20">
             <Check size={48} strokeWidth={3} />
        </div>
        <h2 className={`text-4xl font-bold mb-4 tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>Session Complete!</h2>
        <div className="text-center mb-12">
            <p className={`text-lg font-medium ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>You scored</p>
            <p className="text-6xl font-bold text-indigo-600 mt-2 tracking-tighter">{score} <span className="text-3xl text-gray-400 font-medium">/ {set.cards.length}</span></p>
        </div>
        <button onClick={onBack} className={`px-10 py-4 rounded-full font-bold text-lg transition-all hover:scale-105 active:scale-95 shadow-lg ${darkMode ? 'bg-white text-black hover:bg-gray-100' : 'bg-black text-white hover:bg-gray-800'}`}>Back to Set</button>
      </div>
    );
  }

  if (!currentQ) return <div className="p-8 text-center">Loading...</div>;

  return (
    <div className="max-w-2xl mx-auto h-full flex flex-col p-4">
      <div className="flex justify-between items-center mb-8">
        <button onClick={onBack} className={`${darkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'} font-semibold transition-colors`}>Quit</button>
        <span className={`text-sm font-bold tracking-wide px-3 py-1 rounded-full ${darkMode ? 'bg-[#2c2c2e] text-gray-300' : 'bg-gray-100 text-gray-500'}`}>{set.cards.length - queue.length + 1} / {set.cards.length}</span>
      </div>

      <div className={`rounded-3xl shadow-sm p-10 mb-8 flex-grow-0 min-h-[240px] flex items-center justify-center text-center border transition-all ${darkMode ? 'bg-[#1c1c1e] border-gray-800' : 'bg-white border-gray-100'}`}>
        <div>
            <span className={`text-xs uppercase font-bold tracking-widest mb-4 block opacity-60 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Definition</span>
            <p className={`text-2xl font-medium leading-relaxed ${darkMode ? 'text-white' : 'text-gray-900'}`}>{currentQ.def}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <span className={`text-xs uppercase font-bold tracking-widest mb-2 ml-1 opacity-60 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Choose the matching term</span>
        {options.map(opt => {
          let statusClass = darkMode 
            ? "border-gray-800 bg-[#1c1c1e] hover:bg-[#2c2c2e]" 
            : "border-gray-100 bg-white hover:border-indigo-200 hover:shadow-md";
          
          let textClass = darkMode ? 'text-gray-200' : 'text-gray-800';

          if (selectedOption) {
             if (opt.id === currentQ.id) {
               statusClass = "border-green-500 bg-green-500 text-white";
               textClass = "text-white";
             } else if (opt.id === selectedOption.id && !isCorrect) {
               statusClass = "border-red-500 bg-red-500 text-white";
               textClass = "text-white";
             } else {
               statusClass = darkMode ? "border-gray-800 opacity-30" : "border-gray-100 opacity-30";
             }
          }

          return (
            <button
              key={opt.id}
              onClick={() => handleAnswer(opt)}
              disabled={!!selectedOption}
              className={`w-full p-5 text-left rounded-2xl border-2 transition-all duration-200 font-semibold text-lg ${statusClass} ${!selectedOption ? textClass : ''}`}
            >
              {opt.term}
            </button>
          );
        })}
      </div>

      {selectedOption && (
        <div className="mt-8 animate-in slide-in-from-bottom-4 fade-in">
          <button 
            onClick={handleNext}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 transition-all active:scale-95"
          >
            {queue.length === 1 ? 'Finish' : 'Next Question'}
          </button>
        </div>
      )}
    </div>
  );
};

// 7. CREATE/EDIT SET COMPONENT
const CreateSet = ({ onSave, onCancel, editSet = null, darkMode }) => {
  const [title, setTitle] = useState(editSet ? editSet.title : '');
  const [desc, setDesc] = useState(editSet ? editSet.description : '');
  const [cards, setCards] = useState(editSet ? editSet.cards : [
    { id: generateId(), term: '', def: '' },
    { id: generateId(), term: '', def: '' },
    { id: generateId(), term: '', def: '' }
  ]);

  const addCard = () => {
    setCards([...cards, { id: generateId(), term: '', def: '' }]);
  };

  const updateCard = (id, field, value) => {
    setCards(cards.map(c => c.id === id ? { ...c, [field]: value } : c));
  };

  const removeCard = (id) => {
    setCards(cards.filter(c => c.id !== id));
  };

  const handleSave = () => {
    if (!title.trim()) return alert('Please enter a title');
    const validCards = cards.filter(c => c.term.trim() || c.def.trim());
    if (validCards.length < 2) return alert('Please add at least 2 cards');
    
    onSave({
      id: editSet ? editSet.id : generateId(),
      title,
      description: desc,
      cards: validCards
    });
  };

  const bgClass = darkMode ? 'bg-[#1c1c1e] border-gray-800' : 'bg-white border-gray-200';
  const inputClass = darkMode ? 'bg-[#2c2c2e] text-white focus:ring-2 focus:ring-indigo-500/50' : 'bg-gray-100 text-gray-900 focus:bg-white focus:ring-2 focus:ring-indigo-500/20';

  return (
    <div className="max-w-5xl mx-auto p-4 pb-20 animate-in fade-in">
      <div className={`sticky top-0 z-20 py-6 mb-8 flex justify-between items-center backdrop-blur-xl border-b transition-colors ${darkMode ? 'bg-black/50 border-gray-800' : 'bg-white/80 border-gray-200/50'}`}>
        <h1 className={`text-2xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>{editSet ? 'Edit Study Set' : 'Create New Set'}</h1>
        <div className="flex gap-4">
           <button onClick={onCancel} className={`px-5 py-2.5 font-semibold rounded-full transition-colors ${darkMode ? 'text-gray-300 hover:bg-[#2c2c2e]' : 'text-gray-600 hover:bg-gray-100'}`}>Cancel</button>
           <button onClick={handleSave} className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-full hover:bg-indigo-700 shadow-lg shadow-indigo-500/30 active:scale-95 transition-all">
            {editSet ? 'Save Changes' : 'Create'}
           </button>
        </div>
      </div>

      <div className="space-y-8">
        <div className={`p-8 rounded-3xl shadow-sm border ${bgClass}`}>
          <div className="space-y-6">
            <div>
              <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ml-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Title</label>
              <input 
                type="text" 
                placeholder='e.g., "Biology - Chapter 22"'
                className={`w-full text-lg font-medium rounded-2xl px-4 py-3 outline-none transition-all ${inputClass}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ml-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Description</label>
              <input 
                type="text" 
                placeholder='What is this set about?'
                className={`w-full rounded-2xl px-4 py-3 outline-none transition-all ${inputClass}`}
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {cards.map((card, index) => (
            <div key={card.id} className={`group p-6 rounded-3xl shadow-sm border transition-all ${bgClass} ${darkMode ? 'hover:border-gray-700' : 'hover:border-indigo-200 hover:shadow-md'}`}>
              <div className={`flex justify-between mb-4 border-b pb-4 ${darkMode ? 'border-gray-800' : 'border-gray-100'}`}>
                <span className="font-bold text-gray-400 px-3 py-1 bg-gray-100/10 rounded-full">{index + 1}</span>
                <button onClick={() => removeCard(card.id)} className="text-gray-400 hover:text-red-500 transition p-2 hover:bg-red-50 rounded-full"><Trash2 size={18} /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                   <label className={`text-xs font-bold uppercase tracking-wider mb-2 block ml-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Term</label>
                   <input 
                    value={card.term}
                    onChange={(e) => updateCard(card.id, 'term', e.target.value)}
                    className={`w-full text-lg rounded-xl px-4 py-3 outline-none transition-all ${inputClass}`}
                    placeholder="Enter term"
                   />
                </div>
                <div>
                   <label className={`text-xs font-bold uppercase tracking-wider mb-2 block ml-1 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>Definition</label>
                   <input 
                    value={card.def}
                    onChange={(e) => updateCard(card.id, 'def', e.target.value)}
                    className={`w-full text-lg rounded-xl px-4 py-3 outline-none transition-all ${inputClass}`}
                    placeholder="Enter definition"
                   />
                </div>
              </div>
            </div>
          ))}
        </div>

        <button 
          onClick={addCard}
          className={`w-full py-6 border-2 border-dashed rounded-3xl font-bold transition-all flex items-center justify-center gap-2 group ${darkMode ? 'bg-[#1c1c1e] border-gray-800 text-gray-400 hover:border-indigo-500 hover:text-indigo-400' : 'bg-white border-gray-300 text-gray-500 hover:border-indigo-500 hover:text-indigo-600 hover:bg-indigo-50'}`}
        >
          <div className={`p-2 rounded-full transition-colors ${darkMode ? 'bg-[#2c2c2e] group-hover:bg-indigo-500/20' : 'bg-gray-100 group-hover:bg-indigo-100'}`}>
             <Plus size={24} /> 
          </div>
          Add Card
        </button>
      </div>
    </div>
  );
};

/**
 * MAIN APP COMPONENT
 */
const App = () => {
  // State
  const [sets, setSets] = useState(() => {
    const saved = localStorage.getItem('quizdeck_sets');
    return saved ? JSON.parse(saved) : INITIAL_SETS;
  });
  const [view, setView] = useState('home'); 
  const [activeSetId, setActiveSetId] = useState(null);
  const [editingSetId, setEditingSetId] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Persist
  useEffect(() => {
    localStorage.setItem('quizdeck_sets', JSON.stringify(sets));
  }, [sets]);

  const activeSet = useMemo(() => sets.find(s => s.id === activeSetId), [sets, activeSetId]);

  // Handlers
  const handleSaveSet = (newSet) => {
    if (editingSetId) {
      setSets(sets.map(s => s.id === editingSetId ? newSet : s));
      setEditingSetId(null);
    } else {
      setSets([...sets, newSet]);
    }
    setView('home');
  };

  const handleDeleteSet = (id) => {
    if(window.confirm('Are you sure you want to delete this set?')) {
      setSets(sets.filter(s => s.id !== id));
      setView('home');
      setActiveSetId(null);
    }
  };

  // Theme Constants - refined for Apple feel
  const bgMain = darkMode ? 'bg-[#000000]' : 'bg-[#F5F5F7]'; // Apple dark black vs off-white
  const textMain = darkMode ? 'text-gray-100' : 'text-gray-900';
  const cardBg = darkMode ? 'bg-[#1c1c1e] border-gray-800' : 'bg-white border-white/50';
  const cardHover = darkMode ? 'hover:bg-[#2c2c2e]' : 'hover:shadow-xl hover:shadow-black/5 hover:-translate-y-1';

  // View Switcher
  const renderContent = () => {
    switch(view) {
      case 'ai-create':
        return <AIGenerator onSave={handleSaveSet} onCancel={() => setView('home')} darkMode={darkMode} />;

      case 'create':
        return <CreateSet onSave={handleSaveSet} onCancel={() => setView('home')} editSet={editingSetId ? sets.find(s => s.id === editingSetId) : null} darkMode={darkMode} />;
      
      case 'flashcards':
        return <FlashcardMode set={activeSet} onBack={() => setView('set')} darkMode={darkMode} />;
      
      case 'match':
        return <MatchMode set={activeSet} onBack={() => setView('set')} darkMode={darkMode} />;

      case 'learn':
        return <LearnMode set={activeSet} onBack={() => setView('set')} darkMode={darkMode} />;
      
      case 'set':
        if (!activeSet) return null;
        return (
          <div className="max-w-5xl mx-auto p-4 animate-in fade-in">
            <div className="mb-12">
               <button onClick={() => setView('home')} className="mb-6 flex items-center text-indigo-500 hover:text-indigo-600 font-semibold transition-colors"><ChevronLeft size={20} className="mr-1" /> Library</button>
               <h1 className={`text-5xl font-bold mb-4 tracking-tight leading-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>{activeSet.title}</h1>
               <div className="flex justify-between items-start">
                 <p className={`text-xl leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{activeSet.description}</p>
                 <div className="flex gap-3">
                   <button 
                     onClick={() => { setEditingSetId(activeSet.id); setView('create'); }} 
                     className={`p-3 rounded-full transition-all ${darkMode ? 'bg-[#1c1c1e] text-gray-400 hover:bg-[#2c2c2e] hover:text-white' : 'bg-white text-gray-400 hover:text-indigo-600 hover:shadow-lg'}`}
                     title="Edit Set"
                    >
                     <Settings size={20} />
                   </button>
                   <button 
                     onClick={() => handleDeleteSet(activeSet.id)}
                     className={`p-3 rounded-full transition-all ${darkMode ? 'bg-[#1c1c1e] text-gray-400 hover:bg-[#2c2c2e] hover:text-red-400' : 'bg-white text-gray-400 hover:text-red-600 hover:shadow-lg'}`}
                     title="Delete Set"
                   >
                     <Trash2 size={20} />
                   </button>
                 </div>
               </div>
            </div>

            {/* Action Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
               {[
                 { id: 'flashcards', icon: Layers, title: 'Flashcards', desc: 'Review terms.', color: 'text-indigo-500', bg: 'bg-indigo-500/10' },
                 { id: 'learn', icon: Brain, title: 'Learn', desc: 'Master the set.', color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
                 { id: 'match', icon: Gamepad2, title: 'Match', desc: 'Race time.', color: 'text-amber-500', bg: 'bg-amber-500/10' }
               ].map(mode => (
                 <button 
                    key={mode.id}
                    onClick={() => setView(mode.id)} 
                    className={`group flex flex-col items-start p-8 rounded-3xl border shadow-sm transition-all duration-300 ${cardBg} ${cardHover}`}
                  >
                    <div className={`p-4 rounded-2xl mb-5 transition-transform group-hover:scale-110 ${mode.bg} ${mode.color}`}>
                      <mode.icon size={32} strokeWidth={2.5} />
                    </div>
                    <h3 className={`text-2xl font-bold mb-2 tracking-tight ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{mode.title}</h3>
                    <p className={`text-base font-medium ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>{mode.desc}</p>
                 </button>
               ))}
            </div>

            {/* Terms List */}
            <div className={`rounded-3xl shadow-sm border overflow-hidden ${cardBg}`}>
              <div className={`p-6 border-b font-bold tracking-wide uppercase text-sm ${darkMode ? 'bg-[#1c1c1e] border-gray-800 text-gray-400' : 'bg-white border-gray-100 text-gray-400'}`}>
                Terms in this set ({activeSet.cards.length})
              </div>
              <div className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-50'}`}>
                {activeSet.cards.map(card => (
                  <div key={card.id} className={`p-6 md:p-8 grid grid-cols-1 md:grid-cols-3 gap-6 transition ${darkMode ? 'hover:bg-[#2c2c2e]' : 'hover:bg-gray-50/50'}`}>
                    <div className={`md:col-span-1 border-r-0 md:border-r md:pr-6 font-semibold text-lg ${darkMode ? 'border-gray-800 text-gray-200' : 'border-gray-100 text-gray-900'}`}>
                      {card.term}
                    </div>
                    <div className={`md:col-span-2 text-lg ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {card.def}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 'home':
      default:
        return (
          <div className="max-w-5xl mx-auto p-6 animate-in fade-in">
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
               <div>
                 <h1 className={`text-4xl font-bold tracking-tight mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>Library</h1>
                 <p className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Manage your study sets</p>
               </div>
               <div className="flex gap-4">
                 <button 
                   onClick={() => setView('ai-create')}
                   className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-indigo-500/30 hover:scale-105 active:scale-95 transition-all flex items-center"
                 >
                   <Sparkles size={18} className="mr-2" /> Magic Create
                 </button>
                 <button 
                   onClick={() => { setEditingSetId(null); setView('create'); }}
                   className={`border px-6 py-3 rounded-full font-bold shadow-sm transition-all hover:scale-105 active:scale-95 flex items-center ${darkMode ? 'bg-[#1c1c1e] border-gray-700 text-gray-300 hover:bg-[#2c2c2e]' : 'bg-white border-white text-gray-700 hover:bg-gray-50'}`}
                 >
                   <Plus size={18} className="mr-2" /> Manual
                 </button>
               </div>
            </div>

            {sets.length === 0 ? (
              <div className={`text-center py-32 rounded-3xl border-2 border-dashed ${darkMode ? 'bg-[#1c1c1e] border-gray-800' : 'bg-white border-gray-200'}`}>
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-300">
                   <Library size={40} />
                </div>
                <h3 className={`text-2xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>No study sets yet</h3>
                <p className="text-gray-400 mb-8 max-w-md mx-auto">Create your first flashcard deck to get started learning faster.</p>
                <button onClick={() => setView('ai-create')} className="text-indigo-500 font-bold hover:text-indigo-600 hover:underline flex items-center justify-center mx-auto"><Sparkles size={18} className="mr-2"/> Generate with AI</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {sets.map(set => (
                  <div 
                    key={set.id} 
                    onClick={() => { setActiveSetId(set.id); setView('set'); }}
                    className={`p-8 rounded-3xl shadow-sm border cursor-pointer transition-all duration-300 group relative overflow-hidden ${cardBg} ${cardHover}`}
                  >
                    <h3 className={`text-xl font-bold mb-3 line-clamp-1 group-hover:text-indigo-500 transition-colors ${darkMode ? 'text-gray-100' : 'text-gray-900'}`}>{set.title}</h3>
                    <p className={`text-sm mb-6 line-clamp-2 h-10 leading-relaxed ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{set.description || "No description"}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${darkMode ? 'bg-[#2c2c2e] text-indigo-300' : 'bg-indigo-50 text-indigo-600'}`}>
                        {set.cards.length} terms
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 selection:bg-indigo-500/30 ${bgMain} ${textMain}`}>
      {/* Header */}
      <header className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-colors duration-300 ${darkMode ? 'bg-black/70 border-gray-800' : 'bg-white/70 border-gray-200/50'}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div 
            className="flex items-center gap-3 cursor-pointer select-none group" 
            onClick={() => setView('home')}
          >
            <div className="w-10 h-10 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 transition-transform group-hover:scale-105">
              <Brain size={24} strokeWidth={2.5} />
            </div>
            <span className="text-2xl font-bold tracking-tight">QuizDeck</span>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowSettings(true)}
              className={`p-2.5 rounded-full transition-all active:scale-95 ${darkMode ? 'bg-[#1c1c1e] text-gray-300 hover:bg-[#2c2c2e]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              title="Settings"
            >
              <Settings size={20} />
            </button>
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2.5 rounded-full transition-all active:scale-95 ${darkMode ? 'bg-[#1c1c1e] text-yellow-400 hover:bg-[#2c2c2e]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <Sun size={20} strokeWidth={2.5} /> : <Moon size={20} strokeWidth={2.5} />}
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold text-sm shadow-md ring-2 ring-white/20">
              ME
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-8 pb-24 relative px-2">
        {renderContent()}
        <ChatWidget activeSet={view === 'set' || view === 'flashcards' || view === 'learn' ? activeSet : null} darkMode={darkMode} />
        <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} darkMode={darkMode} />
      </main>

      {/* CSS for 3D Flip */}
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
};

export default App;