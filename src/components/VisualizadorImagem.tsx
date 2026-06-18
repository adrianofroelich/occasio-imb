import { useState } from "react"
import { X, ZoomIn, ZoomOut, Maximize2, AlertCircle } from "lucide-react"

interface VisualizadorImagemProps {
  src: string
  alt?: string
  onClose: () => void
}

export default function VisualizadorImagem({ src, alt = "Imagem do chamado", onClose }: VisualizadorImagemProps) {
  const [scale, setScale] = useState(1)

  // Incrementa a escala do zoom até no máximo 4x
  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.25, 4))
  }

  // Decrementa a escala do zoom até no máximo 1x
  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.25, 1))
  }

  // Reseta o zoom para o tamanho original 1x
  const handleReset = () => {
    setScale(1)
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/95 p-4 backdrop-blur-sm">
      
      {/* Barra Superior de Controle e Zoom */}
      <div className="absolute top-0 inset-x-0 h-16 flex items-center justify-between px-6 bg-slate-900/50 backdrop-blur-md border-b border-white/10 z-50">
        <span className="text-white text-xs font-semibold select-none flex items-center gap-1.5 opacity-90">
          <AlertCircle className="h-4 w-4 text-occasio-blue" />
          Modo Inspeção Técnica (Zoom: {Math.round(scale * 100)}%)
        </span>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleZoomOut} 
            disabled={scale === 1}
            className="p-2 text-white hover:text-occasio-blue bg-white/5 rounded-lg border border-white/10 disabled:opacity-40 transition-colors"
            title="Reduzir Zoom"
            type="button"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button 
            onClick={handleZoomIn} 
            disabled={scale === 4}
            className="p-2 text-white hover:text-occasio-blue bg-white/5 rounded-lg border border-white/10 disabled:opacity-40 transition-colors"
            title="Ampliar Zoom"
            type="button"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button 
            onClick={handleReset} 
            disabled={scale === 1}
            className="p-2 text-white hover:text-occasio-blue bg-white/5 rounded-lg border border-white/10 disabled:opacity-40 transition-colors"
            title="Ajustar ao Tamanho Real"
            type="button"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <div className="w-px h-6 bg-white/15 mx-1" />
          <button 
            onClick={onClose} 
            className="p-2 text-white hover:text-red-400 bg-white/5 rounded-lg border border-white/10 transition-colors"
            title="Fechar Inspeção"
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Área Central de Exibição com Overflow para rolagem panorâmica */}
      <div className="w-full h-full flex items-center justify-center overflow-auto pt-16">
        <div 
          className="transition-transform duration-200 ease-out origin-center"
          style={{ transform: `scale(${scale})` }}
        >
          <img 
            src={src} 
            alt={alt} 
            className="max-h-[75vh] max-w-[90vw] object-contain rounded shadow-2xl select-none"
            draggable={false}
          />
        </div>
      </div>
      
      {/* Rodapé informativo (preparação futura para marcações de pin) */}
      <div className="absolute bottom-4 inset-x-0 text-center text-[10px] text-slate-500 pointer-events-none select-none">
        Suporte a marcações visuais integrado em `marcacoes_json`.
      </div>
      
    </div>
  )
}
