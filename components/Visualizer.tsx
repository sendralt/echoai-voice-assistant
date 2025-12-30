
import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isActive: boolean;
  color?: string;
}

export const Visualizer: React.FC<VisualizerProps> = ({ isActive, color = '#39ff14' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frames = 0;
    const bars = 20;
    const barWidth = 2;
    const gap = 2;

    const render = () => {
      frames++;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw baseline
      ctx.strokeStyle = 'rgba(57, 255, 20, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, canvas.height/2);
      ctx.lineTo(canvas.width, canvas.height/2);
      ctx.stroke();

      for (let i = 0; i < bars; i++) {
        const baseHeight = isActive ? 8 : 2;
        const variance = isActive 
          ? Math.sin(frames * 0.2 + i * 0.8) * 14 + (Math.random() * 6)
          : 0;
        const height = Math.max(2, baseHeight + variance);
        
        ctx.fillStyle = color;
        const x = i * (barWidth + gap);
        const y = (canvas.height - height) / 2;
        
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
        ctx.fillRect(x, y, barWidth, height);
        ctx.shadowBlur = 0;
      }
      
      animationRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isActive, color]);

  return (
    <canvas 
      ref={canvasRef} 
      width={100} 
      height={32} 
      className="opacity-100 transition-all duration-300"
    />
  );
};
