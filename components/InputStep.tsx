'use client';

import React from 'react';
import { FileText, ChevronRight, X, File } from 'lucide-react';
import type { InputSource } from '@/lib/types';
import { AppStep } from '@/lib/types';
import type { Language, translations } from '@/lib/translations';

interface Props {
  inputSource: InputSource;
  setInputSource: (source: InputSource) => void;
  setStep: (step: AppStep) => void;
  t: typeof translations['en'];
  uiLanguage: Language;
}

export const InputStep: React.FC<Props> = ({ inputSource, setInputSource, setStep, t, uiLanguage }) => {
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      alert(uiLanguage === 'en' ? "File is too large (Max 20MB)" : "文件过大 (最大 20MB)");
      return;
    }

    setInputSource({ type: 'text', textContent: '' });

    if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64String = (event.target?.result as string).split(',')[1];
        setInputSource({
          type: 'file',
          fileData: base64String,
          mimeType: 'application/pdf',
          fileName: file.name
        });
      };
      reader.readAsDataURL(file);
    } else if (file.name.endsWith('.docx')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        if (window.mammoth) {
          const result = await window.mammoth.extractRawText({ arrayBuffer });
          setInputSource({
            type: 'text',
            textContent: result.value,
            fileName: file.name
          });
        } else {
          alert("Word processor not loaded yet. Please try again in a moment.");
        }
      } catch (error) {
        console.error("Error parsing Word file", error);
        alert("Failed to read Word document.");
      }
    } else {
      const text = await file.text();
      setInputSource({
        type: 'text',
        textContent: text,
        fileName: file.name
      });
    }
  };

  const clearFile = () => {
    setInputSource({ type: 'text', textContent: '' });
    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  return (
    <div className="max-w-4xl mx-auto w-full p-6 animate-fade-in">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-foreground mb-4 tracking-tight">{t.appTitle}</h1>
        <p className="text-lg text-muted-foreground">{t.subtitle}</p>
      </div>

      <div className="bg-white dark:bg-card rounded-2xl shadow-xl border border-border/50 p-8 mb-10">
        <div className="mb-6 flex justify-between items-center">
          <label className="block text-lg font-semibold text-foreground/90 tracking-tight">{t.sourceMaterial}</label>
          <div className="relative group">
            <input 
              id="file-upload"
              type="file" 
              accept=".txt,.md,.json,.pdf,.docx" 
              onChange={handleFileUpload}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            />
            <button className="relative px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2 group-hover:scale-105">
              <FileText className="w-4 h-4" /> 
              <span>{t.uploadBtn}</span>
            </button>
          </div>
        </div>
        
        {inputSource.fileName ? (
          <div className="w-full h-72 flex flex-col items-center justify-center border-2 border-dashed border-primary/20 rounded-xl bg-gradient-to-b from-primary/5 to-transparent relative group transition-all duration-300 hover:border-primary/40">
            <button 
              onClick={clearFile}
              className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-full transition-all duration-200 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0"
              title={t.removeFile}
            >
              <X className="w-5 h-5" />
            </button>
            <div className="w-20 h-20 bg-white rounded-2xl shadow-lg flex items-center justify-center mb-6 transform transition-transform group-hover:scale-110 duration-300">
              <File className="w-10 h-10 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm font-bold text-primary tracking-wider uppercase">{t.fileUploaded}</p>
              <p className="text-2xl font-semibold text-foreground tracking-tight max-w-md truncate px-4">{inputSource.fileName}</p>
              {inputSource.type === 'file' && (
                <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                  PDF Analysis Mode
                </span>
              )}
              {inputSource.type === 'text' && inputSource.textContent && (
                <p className="text-sm text-muted-foreground">
                  ({inputSource.textContent.length.toLocaleString()} {t.charCount})
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="relative group">
            <textarea
              value={inputSource.textContent || ''}
              onChange={(e) => setInputSource({ type: 'text', textContent: e.target.value })}
              placeholder={t.pastePlaceholder}
              className="w-full h-72 p-6 rounded-xl border border-input bg-background/50 hover:bg-background/80 focus:bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 resize-none text-foreground text-lg leading-relaxed placeholder:text-muted-foreground/50 shadow-inner"
            />
            <div className="absolute bottom-4 right-4 text-xs font-medium text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded-md border border-border">
              {(inputSource.textContent || '').length.toLocaleString()} {t.charCount}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-center">
        <button
          disabled={!inputSource.textContent && !inputSource.fileData}
          onClick={() => setStep(AppStep.CONFIG)}
          className="bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none text-primary-foreground text-lg font-semibold py-3 px-10 rounded-full transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
        >
          {t.nextBtn} <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
