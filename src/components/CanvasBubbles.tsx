
import { useEffect, useRef } from 'react';

interface Bubble {
  x: number;
  y: number;
  radius: number;
  speed: number;
  opacity: number;
  driftSpeed: number;
  driftOffset: number;
  wobbleSpeed: number;
  wobbleOffset: number;
  baseRadius: number;
  repulsionX: number;
  repulsionY: number;
  repulsionDecay: number;
  layer: 'background' | 'mid' | 'foreground' | 'accent';
  colorTemp: 'cool' | 'neutral' | 'warm';
  quadrant: number;
  schoolId?: number;
  breathingOffset: number;
}

export const CanvasBubbles = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const bubblesRef = useRef<Bubble[]>([]);
  const timeRef = useRef(0);
  const mouseRef = useRef({ x: -1000, y: -1000, isOver: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn('Canvas context not available');
      return;
    }

    // Set canvas size with proper initialization and error handling
    const resizeCanvas = () => {
      try {
        const rect = canvas.getBoundingClientRect();
        const width = rect.width || window.innerWidth;
        const height = rect.height || window.innerHeight;
        
        // Only resize if dimensions are valid
        if (width > 0 && height > 0) {
          canvas.width = width;
          canvas.height = height;
        }
      } catch (error) {
        console.warn('Error resizing canvas:', error);
      }
    };

    // Use requestAnimationFrame with delay to ensure DOM is ready
    const initCanvas = () => {
      setTimeout(() => {
        resizeCanvas();
      }, 50);
    };
    
    initCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Mouse event listeners - use document since canvas has pointer-events-none
    const handleMouseMove = (e: MouseEvent) => {
      try {
        const rect = canvas.getBoundingClientRect();
        mouseRef.current.x = e.clientX - rect.left;
        mouseRef.current.y = e.clientY - rect.top;
        mouseRef.current.isOver = true;
      } catch (error) {
        console.warn('Error handling mouse move:', error);
      }
    };

    const handleMouseEnter = () => {
      mouseRef.current.isOver = true;
    };

    const handleMouseLeave = () => {
      mouseRef.current.isOver = false;
      mouseRef.current.x = -1000;
      mouseRef.current.y = -1000;
    };

    // Listen on document instead of canvas since canvas has pointer-events-none
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseenter', handleMouseEnter);
    document.addEventListener('mouseleave', handleMouseLeave);

    // Helper function to get quadrant position
    const getQuadrantPosition = (quadrant: number, canvas: HTMLCanvasElement) => {
      const margin = 100;
      switch (quadrant) {
        case 0: return { x: Math.random() * (canvas.width / 2 - margin) + margin, startHeight: canvas.height + Math.random() * 150 };
        case 1: return { x: Math.random() * (canvas.width / 2 - margin) + canvas.width / 2, startHeight: canvas.height + Math.random() * 200 };
        case 2: return { x: Math.random() * (canvas.width / 2 - margin) + margin, startHeight: canvas.height + Math.random() * 300 };
        case 3: return { x: Math.random() * (canvas.width / 2 - margin) + canvas.width / 2, startHeight: canvas.height + Math.random() * 250 };
        default: return { x: Math.random() * canvas.width, startHeight: canvas.height + Math.random() * 200 };
      }
    };

    // Initialize bubbles with balanced distribution
    const initBubbles = () => {
      bubblesRef.current = [];
      let quadrantIndex = 0;
      
      // Background Layer: 2 very large, subtle bubbles
      for (let i = 0; i < 2; i++) {
        const baseRadius = Math.random() * 8 + 25; // 25-33px radius
        const position = getQuadrantPosition(quadrantIndex % 4, canvas);
        bubblesRef.current.push({
          x: position.x,
          y: position.startHeight,
          radius: baseRadius,
          baseRadius,
          speed: Math.random() * 0.15 + 0.1, // 0.1-0.25px per frame
          opacity: Math.random() * 0.04 + 0.08, // 0.08-0.12 opacity
          driftSpeed: Math.random() * 0.08 + 0.03,
          driftOffset: Math.random() * Math.PI * 2,
          wobbleSpeed: Math.random() * 0.005 + 0.008, // Very slow wobble
          wobbleOffset: Math.random() * Math.PI * 2,
          repulsionX: 0,
          repulsionY: 0,
          repulsionDecay: 0.995,
          layer: 'background',
          colorTemp: 'cool',
          quadrant: quadrantIndex % 4,
          breathingOffset: Math.random() * Math.PI * 2,
        });
        quadrantIndex++;
      }
      
      // Mid Layer: 4 medium-large bubbles (workhorses)
      for (let i = 0; i < 4; i++) {
        const baseRadius = Math.random() * 6 + 12; // 12-18px radius
        const position = getQuadrantPosition(quadrantIndex % 4, canvas);
        const schoolId = Math.floor(i / 2); // Group in pairs
        bubblesRef.current.push({
          x: position.x,
          y: position.startHeight,
          radius: baseRadius,
          baseRadius,
          speed: Math.random() * 0.3 + 0.4, // 0.4-0.7px per frame
          opacity: Math.random() * 0.1 + 0.15, // 0.15-0.25 opacity
          driftSpeed: Math.random() * 0.15 + 0.1,
          driftOffset: Math.random() * Math.PI * 2,
          wobbleSpeed: Math.random() * 0.02 + 0.03,
          wobbleOffset: Math.random() * Math.PI * 2,
          repulsionX: 0,
          repulsionY: 0,
          repulsionDecay: 0.97,
          layer: 'mid',
          colorTemp: 'neutral',
          quadrant: quadrantIndex % 4,
          schoolId,
          breathingOffset: Math.random() * Math.PI * 2,
        });
        quadrantIndex++;
      }
      
      // Foreground Layer: 3 small-medium bubbles
      for (let i = 0; i < 3; i++) {
        const baseRadius = Math.random() * 4 + 6; // 6-10px radius
        const position = getQuadrantPosition(quadrantIndex % 4, canvas);
        bubblesRef.current.push({
          x: position.x,
          y: position.startHeight,
          radius: baseRadius,
          baseRadius,
          speed: Math.random() * 0.5 + 0.6, // 0.6-1.1px per frame
          opacity: Math.random() * 0.1 + 0.25, // 0.25-0.35 opacity
          driftSpeed: Math.random() * 0.2 + 0.15,
          driftOffset: Math.random() * Math.PI * 2,
          wobbleSpeed: Math.random() * 0.03 + 0.05,
          wobbleOffset: Math.random() * Math.PI * 2,
          repulsionX: 0,
          repulsionY: 0,
          repulsionDecay: 0.95,
          layer: 'foreground',
          colorTemp: 'neutral',
          quadrant: quadrantIndex % 4,
          breathingOffset: Math.random() * Math.PI * 2,
        });
        quadrantIndex++;
      }
      
      // Accent Layer: 2 bright accent bubbles for visual interest
      for (let i = 0; i < 2; i++) {
        const baseRadius = Math.random() * 3 + 4; // 4-7px radius
        const position = getQuadrantPosition(quadrantIndex % 4, canvas);
        bubblesRef.current.push({
          x: position.x,
          y: position.startHeight,
          radius: baseRadius,
          baseRadius,
          speed: Math.random() * 0.6 + 0.8, // 0.8-1.4px per frame
          opacity: Math.random() * 0.1 + 0.4, // 0.4-0.5 opacity
          driftSpeed: Math.random() * 0.25 + 0.2,
          driftOffset: Math.random() * Math.PI * 2,
          wobbleSpeed: Math.random() * 0.04 + 0.06,
          wobbleOffset: Math.random() * Math.PI * 2,
          repulsionX: 0,
          repulsionY: 0,
          repulsionDecay: 0.93,
          layer: 'accent',
          colorTemp: 'warm',
          quadrant: quadrantIndex % 4,
          breathingOffset: Math.random() * Math.PI * 2,
        });
        quadrantIndex++;
      }
    };

    initBubbles();

    // Enhanced gradient creation with color temperature
    const createBubbleGradient = (ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, colorTemp: string, layer: string) => {
      const gradient = ctx.createRadialGradient(
        x - radius * 0.3, y - radius * 0.3, 0,
        x, y, radius
      );
      
      if (colorTemp === 'cool') {
        // Cool blues for background/depth
        gradient.addColorStop(0, 'rgba(220, 245, 255, 0.9)');
        gradient.addColorStop(0.3, 'rgba(180, 230, 255, 0.4)');
        gradient.addColorStop(0.7, 'rgba(120, 200, 255, 0.2)');
        gradient.addColorStop(1, 'rgba(80, 150, 255, 0.1)');
      } else if (colorTemp === 'warm') {
        // Warm highlights for accent bubbles
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        gradient.addColorStop(0.2, 'rgba(255, 250, 240, 0.6)');
        gradient.addColorStop(0.6, 'rgba(240, 220, 180, 0.3)');
        gradient.addColorStop(1, 'rgba(200, 180, 120, 0.15)');
      } else {
        // Neutral aqua for mid-layer
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.4)');
        gradient.addColorStop(0.7, 'rgba(200, 240, 255, 0.2)');
        gradient.addColorStop(1, 'rgba(150, 220, 255, 0.1)');
      }
      
      return gradient;
    };

    // Enhanced repulsion with school effects
    const calculateRepulsion = (bubble: Bubble, mouseX: number, mouseY: number, allBubbles: Bubble[]) => {
      const dx = bubble.x - mouseX;
      const dy = bubble.y - mouseY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      let repulsionRadius = 100 - (bubble.baseRadius * 1.5);
      if (bubble.layer === 'background') repulsionRadius *= 0.5;
      if (bubble.layer === 'accent') repulsionRadius *= 1.2;
      
      if (distance < repulsionRadius && distance > 0) {
        const minDistance = Math.max(distance, bubble.baseRadius * 2);
        const strength = (repulsionRadius - minDistance) / repulsionRadius;
        
        let responsiveness = bubble.layer === 'background' ? 0.2 : 
                           bubble.layer === 'accent' ? 0.8 : 0.5;
        
        const force = strength * responsiveness * 1.5;
        const forceX = (dx / distance) * force;
        const forceY = (dy / distance) * force;
        
        bubble.repulsionX += forceX;
        bubble.repulsionY += forceY;
        
        // School effect: influence nearby school members
        if (bubble.schoolId !== undefined) {
          allBubbles.forEach(otherBubble => {
            if (otherBubble.schoolId === bubble.schoolId && otherBubble !== bubble) {
              const schoolDx = otherBubble.x - bubble.x;
              const schoolDy = otherBubble.y - bubble.y;
              const schoolDistance = Math.sqrt(schoolDx * schoolDx + schoolDy * schoolDy);
              
              if (schoolDistance < 150) {
                const influence = 0.3 * (1 - schoolDistance / 150);
                otherBubble.repulsionX += forceX * influence;
                otherBubble.repulsionY += forceY * influence;
              }
            }
          });
        }
      }
    };

    // Animation loop with enhanced effects and visibility check
    const animate = () => {
      // Check if canvas is visible to optimize performance
      if (document.hidden || !canvas.offsetParent) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }
      
      timeRef.current += 0.016;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Add subtle current effect
      const currentX = Math.sin(timeRef.current * 0.1) * 5;
      const currentY = Math.cos(timeRef.current * 0.05) * 2;

      bubblesRef.current.forEach((bubble, index) => {
        // Apply mouse repulsion with school effects
        if (mouseRef.current.isOver) {
          calculateRepulsion(bubble, mouseRef.current.x, mouseRef.current.y, bubblesRef.current);
        }

        // Decay repulsion forces
        bubble.repulsionX *= bubble.repulsionDecay;
        bubble.repulsionY *= bubble.repulsionDecay;

        // Update position with current effects
        bubble.y -= bubble.speed;

        // Enhanced drift with current
        const driftX = Math.sin(timeRef.current * bubble.driftSpeed + bubble.driftOffset) * 12 + currentX;
        
        const currentX_pos = bubble.x + driftX + bubble.repulsionX;
        const currentY_pos = bubble.y + bubble.repulsionY + currentY;

        // Breathing wobble effect
        const breathingWobble = Math.sin(timeRef.current * bubble.wobbleSpeed + bubble.wobbleOffset) * (bubble.baseRadius * 0.08);
        bubble.radius = bubble.baseRadius + breathingWobble;

        // Rhythmic opacity breathing
        const breathingPulse = Math.sin(timeRef.current * 0.3 + bubble.breathingOffset) * 0.03;
        const layerPulse = Math.sin(timeRef.current * 0.8 + index * 0.5) * 0.02;
        const currentOpacity = bubble.opacity + breathingPulse + layerPulse;

        // Reset with quadrant-based positioning
        if (currentY_pos + bubble.radius < -50) {
          const newPosition = getQuadrantPosition(bubble.quadrant, canvas);
          bubble.y = newPosition.startHeight;
          bubble.x = newPosition.x;
          bubble.repulsionX = 0;
          bubble.repulsionY = 0;
          bubble.driftOffset = Math.random() * Math.PI * 2;
          bubble.wobbleOffset = Math.random() * Math.PI * 2;
          bubble.breathingOffset = Math.random() * Math.PI * 2;
        }

        // Horizontal wrapping
        let wrappedX = currentX_pos;
        if (currentX_pos < -bubble.radius) {
          wrappedX = canvas.width + bubble.radius;
          bubble.x = wrappedX;
          bubble.repulsionX = 0;
        } else if (currentX_pos > canvas.width + bubble.radius) {
          wrappedX = -bubble.radius;
          bubble.x = wrappedX;
          bubble.repulsionX = 0;
        }

        // Draw bubble with enhanced gradients
        ctx.save();
        ctx.globalAlpha = Math.max(0.05, Math.min(0.6, currentOpacity));
        
        const gradient = createBubbleGradient(ctx, wrappedX, currentY_pos, bubble.radius, bubble.colorTemp, bubble.layer);
        ctx.fillStyle = gradient;
        
        ctx.beginPath();
        ctx.arc(wrappedX, currentY_pos, bubble.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Layer-specific border effects
        const borderOpacity = bubble.layer === 'accent' ? 0.4 : 
                             bubble.layer === 'foreground' ? 0.2 : 0.1;
        ctx.globalAlpha = Math.max(0.03, Math.min(borderOpacity, currentOpacity * 0.4));
        
        const borderColor = bubble.colorTemp === 'cool' ? 'rgba(120, 200, 255, 0.6)' :
                           bubble.colorTemp === 'warm' ? 'rgba(255, 220, 120, 0.6)' :
                           'rgba(0, 212, 255, 0.6)';
        
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = bubble.layer === 'accent' ? 1 : 0.5;
        ctx.stroke();
        
        ctx.restore();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      window.removeEventListener('resize', resizeCanvas);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseenter', handleMouseEnter);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-[1]"
      style={{ background: 'transparent' }}
    />
  );
};

export default CanvasBubbles;
