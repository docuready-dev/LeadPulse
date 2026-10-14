import React, { useEffect, useRef } from 'react';

interface MeshBackgroundProps {
  variant?: 'landing' | 'platform';
  className?: string;
}

interface NodePoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseAlpha: number;
  color: string;
}

export const MeshBackground: React.FC<MeshBackgroundProps> = ({ variant = 'landing', className = '' }) => {
  const isLanding = variant === 'landing';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isLanding) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let lastTime = performance.now();
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Mouse coordinates with damped tracking
    const mouse = {
      x: -1000,
      y: -1000,
      targetX: -1000,
      targetY: -1000,
      active: false
    };

    // Responsive node count: lightweight for 60fps+ on all devices
    const nodeCount = Math.min(Math.floor((width * height) / 38000), 32);
    const nodes: NodePoint[] = [];

    const colors = [
      'rgba(200, 90, 50,',   // Terracotta
      'rgba(214, 207, 194,',  // Warm Stone
      'rgba(87, 82, 75,',     // Charcoal Muted
    ];

    // Seed nodes
    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 18, // pixels per second
        vy: (Math.random() - 0.5) * 18,
        radius: Math.random() * 1.5 + 1.2,
        baseAlpha: Math.random() * 0.25 + 0.15,
        color: colors[i % colors.length]
      });
    }

    const handleResize = () => {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.scale(dpr, dpr);
    };

    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });

    const handleMouseMove = (e: MouseEvent) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
      mouse.active = true;
    };

    const handleMouseLeave = () => {
      mouse.active = false;
      mouse.targetX = -1000;
      mouse.targetY = -1000;
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseleave', handleMouseLeave);

    // High-refresh render loop: runs at native 60fps, 120fps, or 144fps
    const render = (currentTime: number) => {
      // Calculate delta time in seconds, clamped to avoid jumps when switching tabs
      const dt = Math.min((currentTime - lastTime) / 1000, 0.05);
      lastTime = currentTime;

      // Smooth mouse lerp (spring tracking at 60fps+)
      if (mouse.active) {
        mouse.x += (mouse.targetX - mouse.x) * (1 - Math.exp(-12 * dt));
        mouse.y += (mouse.targetY - mouse.y) * (1 - Math.exp(-12 * dt));
      } else {
        mouse.x = -1000;
        mouse.y = -1000;
      }

      ctx.clearRect(0, 0, width, height);

      // Update and draw nodes
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];

        // Positional step with delta time for uniform speed across 60Hz and 120Hz displays
        node.x += node.vx * dt;
        node.y += node.vy * dt;

        // Screen boundary rebound with gentle damping
        if (node.x < 0) {
          node.x = 0;
          node.vx *= -1;
        } else if (node.x > width) {
          node.x = width;
          node.vx *= -1;
        }

        if (node.y < 0) {
          node.y = 0;
          node.vy *= -1;
        } else if (node.y > height) {
          node.y = height;
          node.vy *= -1;
        }

        // Mouse avoidance/influence vector
        if (mouse.active) {
          const dx = node.x - mouse.x;
          const dy = node.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          const maxDist = 140;
          if (dist < maxDist && dist > 0) {
            const force = (1 - dist / maxDist) * 35;
            node.x += (dx / dist) * force * dt;
            node.y += (dy / dist) * force * dt;
          }
        }

        // Draw node dot
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = `${node.color} ${node.baseAlpha})`;
        ctx.fill();

        // Connect nearby nodes with subtle architectural filaments
        for (let j = i + 1; j < nodes.length; j++) {
          const other = nodes[j];
          const dist = Math.hypot(node.x - other.x, node.y - other.y);
          const linkDist = 125;

          if (dist < linkDist) {
            const alpha = (1 - dist / linkDist) * 0.16;
            ctx.beginPath();
            ctx.moveTo(node.x, node.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = `rgba(200, 90, 50, ${alpha})`;
            ctx.lineWidth = 0.75;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    // Pause animation when document is in background to conserve resources
    const handleVisibilityChange = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationFrameId);
      } else {
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(render);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isLanding]);

  return (
    <div 
      className={`fixed inset-0 pointer-events-none overflow-hidden -z-10 select-none ${className}`}
      aria-hidden="true"
      style={{
        backgroundColor: '#FAF8F5'
      }}
    >
      {/* 60fps+ Hardware-Accelerated Ambient Mesh Canvas */}
      {isLanding && (
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none will-change-transform"
          style={{ transform: 'translate3d(0, 0, 0)' }}
        />
      )}

      {/* Floating Organic Terracotta & Espresso Warmth Blobs */}
      {isLanding && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div
            className="absolute top-[-10%] right-[-5%] w-[580px] h-[580px] rounded-full opacity-35 blur-3xl animate-mesh-blob-1 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(200, 90, 50, 0.16) 0%, rgba(200, 90, 50, 0) 70%)',
              willChange: 'transform',
              transform: 'translate3d(0, 0, 0)'
            }}
          />
          <div
            className="absolute bottom-[10%] left-[-8%] w-[640px] h-[640px] rounded-full opacity-30 blur-3xl animate-mesh-blob-2 pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(25, 23, 22, 0.08) 0%, rgba(25, 23, 22, 0) 75%)',
              willChange: 'transform',
              transform: 'translate3d(0, 0, 0)'
            }}
          />
        </div>
      )}

      {/* Crisp architectural Warm Stone 1px dot matrix */}
      <div 
        className="absolute inset-0 opacity-[0.38] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#D6CFC2 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          transform: 'translate3d(0, 0, 0)'
        }}
      />
    </div>
  );
};

export default MeshBackground;
