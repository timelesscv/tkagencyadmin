import React, { useRef } from 'react';
import { Camera, User, FileText, X, UploadCloud, Loader2 } from 'lucide-react';

interface PhotoUploadCardProps {
  label: string;
  subLabel?: string;
  type: 'face' | 'body' | 'passport';
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  onFileSelected?: (file: File) => void;
  isLoading?: boolean;
  loadingText?: string;
}

export const PhotoUploadCard: React.FC<PhotoUploadCardProps> = ({
  label,
  subLabel = 'CLICK TO UPLOAD',
  type,
  value,
  onChange,
  onFileSelected,
  isLoading = false,
  loadingText = 'Processing...'
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (onFileSelected) {
        onFileSelected(file);
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      if (onFileSelected) {
        onFileSelected(file);
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        onChange(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const renderIcon = () => {
    switch (type) {
      case 'face':
        return <Camera size={26} className="text-slate-400 group-hover:text-pink-400 transition-colors" />;
      case 'body':
        return <User size={26} className="text-slate-400 group-hover:text-pink-400 transition-colors" />;
      case 'passport':
        return <FileText size={26} className="text-slate-400 group-hover:text-pink-400 transition-colors" />;
      default:
        return <UploadCloud size={26} className="text-slate-400" />;
    }
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {value ? (
        <div className="relative h-44 rounded-2xl border border-pink-500/40 bg-[#0d0d22] p-2 flex flex-col items-center justify-center overflow-hidden group shadow-lg">
          <img
            src={value}
            alt={label}
            className="w-full h-full object-cover rounded-xl"
          />
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-pink-500 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-pink-600 transition"
            >
              Change
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange(undefined);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="p-1.5 bg-red-500/80 hover:bg-red-600 text-white rounded-lg transition"
            >
              <X size={16} />
            </button>
          </div>
          <div className="absolute bottom-2 left-2 right-2 bg-black/70 backdrop-blur-sm rounded-lg px-2.5 py-1 text-center">
            <span className="text-[10px] font-bold tracking-widest uppercase text-white truncate block">
              {label}
            </span>
          </div>
        </div>
      ) : (
        <div
          onClick={() => fileInputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          className="h-44 rounded-2xl border-2 border-dashed border-slate-700/80 hover:border-pink-500/60 bg-[#08081a] hover:bg-[#0f0f2b] transition-all duration-300 cursor-pointer flex flex-col items-center justify-center p-4 text-center group shadow-sm"
        >
          <div className="w-14 h-14 rounded-2xl bg-[#12122b] border border-white/5 flex items-center justify-center mb-3 group-hover:scale-110 group-hover:bg-pink-500/10 group-hover:border-pink-500/30 transition-all duration-300 shadow-inner">
            {renderIcon()}
          </div>
          <p className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-1 group-hover:text-white">
            {label}
          </p>
          <p className="text-[10px] font-semibold text-slate-500 tracking-widest uppercase group-hover:text-pink-400 transition-colors">
            {subLabel}
          </p>
        </div>
      )}
      {isLoading && (
        <div className="absolute inset-0 bg-[#08081a]/90 backdrop-blur-sm rounded-2xl border border-pink-500/50 flex flex-col items-center justify-center p-4 z-20">
          <Loader2 size={28} className="text-pink-500 animate-spin mb-2" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">{loadingText}</span>
          <span className="text-[10px] text-slate-400 mt-1">Reading MRZ & details...</span>
        </div>
      )}
    </div>
  );
};
