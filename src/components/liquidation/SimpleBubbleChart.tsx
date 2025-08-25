import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';

interface BubbleData {
  id: string;
  symbol: string;
  name: string;
  icon: string;
  value: number;
  count: number;
  successRate: number;
  change24h: number;
  lastLiquidation: string;
  borrowPoolPercentage: number;
}

interface SimpleBubbleChartProps {
  data: BubbleData[];
  isVolumeView: boolean;
  onViewChange: (isVolumeView: boolean) => void;
  onTokenSelect?: (token: BubbleData | null) => void;
  selectedTokenId?: string;
  className?: string;
}

type TimeRange = '24h' | '7d' | '30d';

interface PhysicsBubble extends BubbleData {
  x: number;
  y: number;
  radius: number;
  baseRadius: number;
  targetRadius: number;
  color: string;
  opacity: number;
  driftSpeed: number;
  driftOffset: number;
  colorTemp: 'cool' | 'neutral' | 'warm';
  breathingOffset: number;
  targetX: number;
  targetY: number;
  isHovered: boolean;
  hoverScale: number;
  hoverProgress: number;
  isSelected: boolean;
  selectionGlow: number;
  clickScale: number;
  clickTime: number;
  magneticX: number;
  magneticY: number;
  velocityX: number;
  velocityY: number;
  glowIntensity: number;
  colorShift: number;
  proximityFactor: number;
  repulsionX: number;
  repulsionY: number;
  floatOffset: number;
  floatSpeed: number;
  primaryFloatSpeed: number;
  secondaryFloatSpeed: number;
  microFloatSpeed: number;
  floatAmplitude: number;
  buoyancy: number;
  environmentalSensitivity: number;
  floatMomentumY: number;
  floatMomentumX: number;
}

// Enhanced easing functions
const easeOutElastic = (t: number): number => {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const easeOutCubic = (t: number): number => {
  return 1 - Math.pow(1 - t, 3);
};

const smoothStep = (t: number): number => {
  return t * t * (3 - 2 * t);
};

const SimpleBubbleChart: React.FC<SimpleBubbleChartProps> = ({
  data,
  isVolumeView,
  onViewChange,
  onTokenSelect,
  selectedTokenId,
  className
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const bubblesRef = useRef<PhysicsBubble[]>([]);
  const timeRef = useRef(0);
  const mouseRef = useRef({ x: -1000, y: -1000, isOver: false });
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [hoveredBubble, setHoveredBubble] = useState<string | null>(null);

  const getTimeRangeMultiplier = (range: TimeRange) => {
    switch (range) {
      case '24h': return 1;
      case '7d': return 2.5;
      case '30d': return 8;
      default: return 1;
    }
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 80) return '#16a34a';
    if (rate >= 60) return '#ca8a04';
    if (rate >= 40) return '#ea580c';
    return '#dc2626';
  };

  const getColorTemperature = (successRate: number): 'cool' | 'neutral' | 'warm' => {
    if (successRate >= 80) return 'cool';
    if (successRate >= 60) return 'neutral';
    return 'warm';
  };

  const hexToRgb = (hex: string): { r: number, g: number, b: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  };

  const calculateBubbleRepulsion = (bubble: PhysicsBubble, allBubbles: PhysicsBubble[]): { x: number, y: number } => {
    // Only check bubbles within reasonable distance for performance
    const nearbyBubbles = allBubbles.filter(other => {
      if (other.id === bubble.id) return false;
      const dx = bubble.x - other.x;
      const dy = bubble.y - other.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance < (bubble.radius + other.radius) * 4.0;
    });

    let repulseX = 0;
    let repulseY = 0;
    
    nearbyBubbles.forEach(other => {
      const dx = bubble.x - other.x;
      const dy = bubble.y - other.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const combinedRadius = bubble.radius + other.radius;
      const minDistance = combinedRadius * 2.2;
      
      if (distance < minDistance && distance > 0) {
        // Exponential force that increases dramatically as bubbles get closer
        const overlap = Math.max(0, minDistance - distance);
        let force = Math.pow(overlap / minDistance, 1.5) * 0.6;
        
        // Hard collision prevention - emergency separation
        if (distance < combinedRadius * 1.1) {
          const emergencyForce = (combinedRadius * 1.1 - distance) * 2.0;
          force = Math.max(force, emergencyForce);
        }
        
        const normalizedX = dx / distance;
        const normalizedY = dy / distance;
        
        repulseX += normalizedX * force;
        repulseY += normalizedY * force;
      }
    });
    
    return { x: repulseX, y: repulseY };
  };

  const createBubbleGradient = (
    ctx: CanvasRenderingContext2D, 
    x: number, 
    y: number, 
    radius: number, 
    baseColor: string,
    isHovered: boolean = false,
    glowIntensity: number = 0,
    colorShift: number = 0
  ) => {
    const gradient = ctx.createRadialGradient(
      x - radius * 0.3, y - radius * 0.3, 0,
      x, y, radius
    );
    
    const { r, g, b } = hexToRgb(baseColor);
    const hoverBoost = isHovered ? 0.1 : 0;
    const glowBoost = glowIntensity * 0.1;
    
    // More solid colors for light mode - reduced transparency
    const baseOpacity = 0.98;
    const centerOpacity = Math.min(1, baseOpacity + hoverBoost + glowBoost);
    const midOpacity = Math.min(1, (baseOpacity * 0.92) + hoverBoost + glowBoost * 0.8);
    const outerOpacity = Math.min(1, (baseOpacity * 0.85) + hoverBoost + glowBoost * 0.6);
    const edgeOpacity = Math.min(1, (baseOpacity * 0.75) + hoverBoost + glowBoost * 0.4);
    
    gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${centerOpacity})`);
    gradient.addColorStop(0.3, `rgba(${r}, ${g}, ${b}, ${midOpacity})`);
    gradient.addColorStop(0.7, `rgba(${r}, ${g}, ${b}, ${outerOpacity})`);
    gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, ${edgeOpacity})`);
    
    return gradient;
  };

  const createColorMatchedGlow = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    baseColor: string,
    intensity: number
  ) => {
    const { r, g, b } = hexToRgb(baseColor);
    const glowGradient = ctx.createRadialGradient(
      x, y, radius * 0.8,
      x, y, radius * 1.5
    );
    
    glowGradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${intensity * 0.3})`);
    glowGradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${intensity * 0.15})`);
    glowGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    
    return glowGradient;
  };

  const calculateProximity = (mouseX: number, mouseY: number, bubble: PhysicsBubble): number => {
    const dx = mouseX - bubble.x;
    const dy = mouseY - bubble.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const influenceRadius = bubble.radius * 2.5;
    
    if (distance > influenceRadius) return 0;
    
    return Math.max(0, 1 - (distance / influenceRadius));
  };

  const calculateMagneticForce = (mouseX: number, mouseY: number, bubble: PhysicsBubble): { x: number, y: number } => {
    const dx = mouseX - bubble.x;
    const dy = mouseY - bubble.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const magneticRadius = bubble.radius * 1.8;
    
    if (distance > magneticRadius || distance < bubble.radius) {
      return { x: 0, y: 0 };
    }
    
    const force = (1 - distance / magneticRadius) * 0.2;
    const normalizedX = dx / distance;
    const normalizedY = dy / distance;
    
    return {
      x: normalizedX * force,
      y: normalizedY * force
    };
  };

  const checkHover = (mouseX: number, mouseY: number, allBubbles: PhysicsBubble[]) => {
    let newHoveredBubble: string | null = null;
    let minDistance = Infinity;
    
    allBubbles.forEach(bubble => {
      const dx = mouseX - bubble.x;
      const dy = mouseY - bubble.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance <= bubble.radius * bubble.hoverScale && distance < minDistance) {
        newHoveredBubble = bubble.id;
        minDistance = distance;
      }
    });
    
    if (newHoveredBubble !== hoveredBubble) {
      setHoveredBubble(newHoveredBubble);
      
      if (onTokenSelect) {
        const hoveredToken = newHoveredBubble ? 
          allBubbles.find(b => b.id === newHoveredBubble) : null;
        onTokenSelect(hoveredToken);
      }
    }
  };

  const initializeBubbles = useCallback((canvas: HTMLCanvasElement) => {
    const multiplier = getTimeRangeMultiplier(timeRange);
    const adjustedData = data.map(item => ({
      ...item,
      value: item.value * multiplier,
      count: Math.floor(item.count * multiplier)
    }));

    const maxValue = Math.max(...adjustedData.map(d => isVolumeView ? d.value : d.count));
    const minRadius = 35;
    const maxRadius = 85;
    
    const bubbles: PhysicsBubble[] = [];
    
    adjustedData.forEach((item, index) => {
      const value = isVolumeView ? item.value : item.count;
      const normalizedSize = Math.sqrt(value / maxValue);
      const baseRadius = minRadius + (maxRadius - minRadius) * normalizedSize;
      
      const cols = Math.ceil(Math.sqrt(adjustedData.length));
      const cellWidth = (canvas.width - 100) / cols;
      const cellHeight = (canvas.height - 100) / Math.ceil(adjustedData.length / cols);
      
      const col = index % cols;
      const row = Math.floor(index / cols);
      
      let targetX = 50 + cellWidth * col + cellWidth / 2;
      let targetY = 50 + cellHeight * row + cellHeight / 2;
      
      // Collision-free initialization - check for overlaps and adjust positions
      let attempts = 0;
      const maxAttempts = 50;
      
      while (attempts < maxAttempts) {
        let hasOverlap = false;
        
        for (const existingBubble of bubbles) {
          const dx = targetX - existingBubble.x;
          const dy = targetY - existingBubble.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const minDistance = (baseRadius + existingBubble.radius) * 2.5;
          
          if (distance < minDistance) {
            hasOverlap = true;
            break;
          }
        }
        
        if (!hasOverlap) {
          break;
        }
        
        // Adjust position if overlap detected
        const angle = Math.random() * Math.PI * 2;
        const offset = 30 + Math.random() * 20;
        targetX += Math.cos(angle) * offset;
        targetY += Math.sin(angle) * offset;
        
        // Keep within canvas bounds
        targetX = Math.max(baseRadius + 10, Math.min(canvas.width - baseRadius - 10, targetX));
        targetY = Math.max(baseRadius + 10, Math.min(canvas.height - baseRadius - 10, targetY));
        
        attempts++;
      }
      
      const colorTemp = getColorTemperature(item.successRate);
      
      // Enhanced floating characteristics based on bubble properties
      const floatAmplitude = baseRadius * (0.08 + Math.random() * 0.04); // 8-12% of radius
      const baseFloatSpeed = Math.random() * 0.001 + 0.0008; // 0.8-1.8
      const buoyancy = (item.successRate / 100) * 0.4 + 0.6; // Better rates = more buoyant
      const environmentalSensitivity = Math.random() * 0.5 + 0.5; // 0.5-1.0
      
      bubbles.push({
        ...item,
        x: targetX,
        y: targetY,
        targetX,
        targetY,
        radius: baseRadius,
        baseRadius,
        targetRadius: baseRadius,
        color: getSuccessRateColor(item.successRate),
        opacity: 0.95,
        driftSpeed: Math.random() * 0.002 + 0.001,
        driftOffset: Math.random() * Math.PI * 2,
        colorTemp,
        breathingOffset: Math.random() * Math.PI * 2,
        isHovered: false,
        hoverScale: 1.0,
        hoverProgress: 0,
        isSelected: false,
        selectionGlow: 0,
        clickScale: 1.0,
        clickTime: 0,
        magneticX: 0,
        magneticY: 0,
        velocityX: 0,
        velocityY: 0,
        glowIntensity: 0,
        colorShift: 0,
        proximityFactor: 0,
        repulsionX: 0,
        repulsionY: 0,
        floatOffset: Math.random() * Math.PI * 2,
        floatSpeed: baseFloatSpeed,
        primaryFloatSpeed: baseFloatSpeed * (0.8 + baseRadius / 200), // Larger = slower
        secondaryFloatSpeed: baseFloatSpeed * 0.3, // Slower sway motion
        microFloatSpeed: baseFloatSpeed * 3, // Fast micro-bobbing
        floatAmplitude,
        buoyancy,
        environmentalSensitivity,
        floatMomentumY: 0,
        floatMomentumX: 0
      });
    });
    
    bubblesRef.current = bubbles;
  }, [data, isVolumeView, timeRange]);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    timeRef.current += 0.016;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (mouseRef.current.isOver) {
      checkHover(mouseRef.current.x, mouseRef.current.y, bubblesRef.current);
    }

    // Environmental effects - gentle air currents
    const airCurrentTime = timeRef.current * 0.0001;
    const airCurrentX = Math.sin(airCurrentTime) * 0.3;
    const airCurrentY = Math.cos(airCurrentTime * 0.7) * 0.2;

    bubblesRef.current.forEach((bubble) => {
      const wasHovered = bubble.isHovered;
      bubble.isHovered = hoveredBubble === bubble.id;
      bubble.isSelected = selectedTokenId === bubble.id;
      
      // Calculate enhanced bubble repulsion with collision prevention
      const repulsion = calculateBubbleRepulsion(bubble, bubblesRef.current);
      bubble.repulsionX += (repulsion.x - bubble.repulsionX) * 0.25;
      bubble.repulsionY += (repulsion.y - bubble.repulsionY) * 0.25;
      
      // Calculate proximity to mouse
      if (mouseRef.current.isOver) {
        bubble.proximityFactor = calculateProximity(mouseRef.current.x, mouseRef.current.y, bubble);
      } else {
        bubble.proximityFactor *= 0.95;
      }
      
      // Enhanced hover progress with elastic easing
      const targetHoverProgress = bubble.isHovered ? 1 : 0;
      const hoverDiff = targetHoverProgress - bubble.hoverProgress;
      bubble.hoverProgress += hoverDiff * (bubble.isHovered ? 0.15 : 0.12);
      
      const baseScale = 1.0 + bubble.proximityFactor * 0.02;
      const hoverScale = bubble.isHovered ? 1.12 : baseScale;
      const scaleDiff = hoverScale - bubble.hoverScale;
      const scaleEasing = bubble.isHovered ? easeOutBack(bubble.hoverProgress) : easeOutCubic(1 - bubble.hoverProgress);
      bubble.hoverScale += scaleDiff * 0.12 * (1 + scaleEasing * 0.6);
      
      const targetGlow = bubble.isSelected ? 1.0 : 0;
      bubble.selectionGlow += (targetGlow - bubble.selectionGlow) * 0.08;
      
      const targetGlowIntensity = bubble.isHovered ? 1.0 : bubble.proximityFactor * 0.7;
      bubble.glowIntensity += (targetGlowIntensity - bubble.glowIntensity) * 0.12;
      
      const targetColorShift = bubble.isHovered ? 1.0 : 0;
      bubble.colorShift += (targetColorShift - bubble.colorShift) * 0.08;
      
      if (bubble.clickTime > 0) {
        bubble.clickTime -= 0.016;
        const clickProgress = Math.max(0, bubble.clickTime / 0.2);
        bubble.clickScale = 1 - clickProgress * 0.08;
      } else {
        bubble.clickScale += (1.0 - bubble.clickScale) * 0.25;
      }
      
      // Force balancing - prioritize repulsion when bubbles are close
      const repulsionMagnitude = Math.sqrt(bubble.repulsionX * bubble.repulsionX + bubble.repulsionY * bubble.repulsionY);
      const magneticDamping = Math.max(0.2, 1 - repulsionMagnitude * 2);
      
      // Magnetic forces with reduced strength when repulsion is active
      if (mouseRef.current.isOver) {
        const magneticForce = calculateMagneticForce(mouseRef.current.x, mouseRef.current.y, bubble);
        bubble.velocityX += magneticForce.x * magneticDamping;
        bubble.velocityY += magneticForce.y * magneticDamping;
      }
      
      // Apply repulsion forces (always full strength)
      bubble.velocityX += bubble.repulsionX;
      bubble.velocityY += bubble.repulsionY;
      
      // Cap velocity to prevent bubbles from moving too fast
      const maxVelocity = 2.0;
      const currentVelocity = Math.sqrt(bubble.velocityX * bubble.velocityX + bubble.velocityY * bubble.velocityY);
      if (currentVelocity > maxVelocity) {
        bubble.velocityX = (bubble.velocityX / currentVelocity) * maxVelocity;
        bubble.velocityY = (bubble.velocityY / currentVelocity) * maxVelocity;
      }
      
      // Apply stronger damping to prevent oscillation
      bubble.velocityX *= 0.88;
      bubble.velocityY *= 0.88;
      
      // Update magnetic position
      bubble.magneticX += bubble.velocityX;
      bubble.magneticY += bubble.velocityY;
      
      // Limit magnetic offset
      const maxMagneticOffset = bubble.baseRadius * 0.4;
      bubble.magneticX = Math.max(-maxMagneticOffset, Math.min(maxMagneticOffset, bubble.magneticX));
      bubble.magneticY = Math.max(-maxMagneticOffset, Math.min(maxMagneticOffset, bubble.magneticY));
      
      // Calculate target radius with all effects
      bubble.targetRadius = bubble.baseRadius * bubble.hoverScale * bubble.clickScale;
      
      // Enhanced layered floating animation
      const proximityFloatBoost = 1 + bubble.proximityFactor * 0.5; // Up to 50% more floating when mouse is near
      const enhancedFloatAmplitude = bubble.floatAmplitude * proximityFloatBoost;
      
      // Primary float - main up-down motion
      const primaryFloat = Math.sin(timeRef.current * bubble.primaryFloatSpeed + bubble.floatOffset) * enhancedFloatAmplitude;
      
      // Secondary float - slower side-to-side swaying
      const secondaryFloatY = Math.sin(timeRef.current * bubble.secondaryFloatSpeed + bubble.floatOffset * 0.7) * (enhancedFloatAmplitude * 0.3);
      const secondaryFloatX = Math.cos(timeRef.current * bubble.secondaryFloatSpeed + bubble.floatOffset) * (enhancedFloatAmplitude * 0.4);
      
      // Micro-bobbing - fast subtle movements
      const microBobY = Math.sin(timeRef.current * bubble.microFloatSpeed + bubble.floatOffset * 1.3) * (enhancedFloatAmplitude * 0.15);
      const microBobX = Math.cos(timeRef.current * bubble.microFloatSpeed + bubble.floatOffset * 1.7) * (enhancedFloatAmplitude * 0.1);
      
      // Combine all floating motions with buoyancy
      const totalFloatY = (primaryFloat + secondaryFloatY + microBobY) * bubble.buoyancy;
      const totalFloatX = (secondaryFloatX + microBobX) * bubble.buoyancy;
      
      // Apply environmental effects
      const environmentalX = airCurrentX * bubble.environmentalSensitivity;
      const environmentalY = airCurrentY * bubble.environmentalSensitivity;
      
      // Add momentum to floating for more natural movement
      bubble.floatMomentumY += (totalFloatY - bubble.floatMomentumY) * 0.1;
      bubble.floatMomentumX += (totalFloatX - bubble.floatMomentumX) * 0.1;
      
      // Reduced drift to prevent overlaps
      const driftIntensity = 0.8 * (1 - bubble.proximityFactor * 0.3);
      const driftX = Math.sin(timeRef.current * bubble.driftSpeed + bubble.driftOffset) * driftIntensity;
      const driftY = Math.cos(timeRef.current * bubble.driftSpeed + bubble.driftOffset) * (driftIntensity * 0.5);
      
      // Final position with all effects including enhanced floating
      bubble.x = bubble.targetX + driftX + bubble.floatMomentumX + environmentalX + bubble.magneticX + bubble.repulsionX;
      bubble.y = bubble.targetY + driftY + bubble.floatMomentumY + environmentalY + bubble.magneticY + bubble.repulsionY;

      // Canvas boundary enforcement with bubble radius consideration
      bubble.x = Math.max(bubble.radius, Math.min(canvas.width - bubble.radius, bubble.x));
      bubble.y = Math.max(bubble.radius, Math.min(canvas.height - bubble.radius, bubble.y));

      // Enhanced breathing effect synced with floating
      const breathingIntensity = bubble.targetRadius * 0.015 * (1 + bubble.hoverProgress * 0.4);
      const breathingWobble = Math.sin(timeRef.current * 0.004 + bubble.breathingOffset) * breathingIntensity;
      const floatBreathing = Math.sin(timeRef.current * bubble.primaryFloatSpeed + bubble.floatOffset) * (breathingIntensity * 0.3);
      bubble.radius = bubble.targetRadius + breathingWobble + floatBreathing;

      if (bubble.selectionGlow > 0.01) {
        ctx.save();
        ctx.globalAlpha = bubble.selectionGlow * 0.8;
        const selectionGlow = createColorMatchedGlow(ctx, bubble.x, bubble.y, bubble.radius, bubble.color, bubble.selectionGlow);
        ctx.fillStyle = selectionGlow;
        ctx.beginPath();
        ctx.arc(bubble.x, bubble.y, bubble.radius * 1.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      if (bubble.glowIntensity > 0.01) {
        ctx.save();
        ctx.globalAlpha = bubble.glowIntensity * 0.5;
        const hoverGlow = createColorMatchedGlow(ctx, bubble.x, bubble.y, bubble.radius, bubble.color, bubble.glowIntensity);
        ctx.fillStyle = hoverGlow;
        ctx.beginPath();
        ctx.arc(bubble.x, bubble.y, bubble.radius * 1.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.globalAlpha = bubble.opacity;
      
      const gradient = createBubbleGradient(
        ctx, bubble.x, bubble.y, bubble.radius, bubble.color,
        bubble.isHovered, bubble.glowIntensity, bubble.colorShift
      );
      ctx.fillStyle = gradient;
      
      ctx.beginPath();
      ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = bubble.isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = bubble.isSelected ? 3 : 2;
      ctx.stroke();
      
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      ctx.beginPath();
      ctx.arc(bubble.x + 2, bubble.y + 2, bubble.radius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffffff';
      const textSize = Math.min(bubble.radius * 0.32, 13) + bubble.hoverProgress * 1.2;
      ctx.font = `bold ${textSize}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
      ctx.shadowBlur = 3;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      
      ctx.fillText(bubble.symbol, bubble.x, bubble.y - 3);
      
      const changeSize = Math.min(bubble.radius * 0.22, 10) + bubble.hoverProgress * 0.8;
      ctx.font = `${changeSize}px Arial`;
      const changeColor = bubble.change24h >= 0 ? '#22c55e' : '#ef4444';
      ctx.fillStyle = changeColor;
      const changeText = `${bubble.change24h >= 0 ? '+' : ''}${bubble.change24h.toFixed(1)}%`;
      ctx.fillText(changeText, bubble.x, bubble.y + 8);
      
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      ctx.restore();
    });

    animationRef.current = requestAnimationFrame(animate);
  }, [selectedTokenId, hoveredBubble]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const clickedBubble = bubblesRef.current.find(bubble => {
      const dx = x - bubble.x;
      const dy = y - bubble.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance <= bubble.radius * bubble.hoverScale;
    });
    
    if (clickedBubble) {
      clickedBubble.clickTime = 0.25;
      
      if (onTokenSelect) {
        onTokenSelect(clickedBubble);
      }
    }
  }, [onTokenSelect]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    mouseRef.current.x = e.clientX - rect.left;
    mouseRef.current.y = e.clientY - rect.top;
    mouseRef.current.isOver = true;
    
    const isOverBubble = bubblesRef.current.some(bubble => {
      const dx = mouseRef.current.x - bubble.x;
      const dy = mouseRef.current.y - bubble.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return distance <= bubble.radius * bubble.hoverScale;
    });
    
    canvas.style.cursor = isOverBubble ? 'pointer' : 'default';
  }, []);

  const handleMouseLeave = useCallback(() => {
    mouseRef.current.isOver = false;
    mouseRef.current.x = -1000;
    mouseRef.current.y = -1000;
    setHoveredBubble(null);
    
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.style.cursor = 'default';
    }
  }, []);

  const formatValue = (value: number) => {
    const multiplier = getTimeRangeMultiplier(timeRange);
    const adjustedValue = value * multiplier;
    
    if (isVolumeView) {
      if (adjustedValue >= 1000000) return `$${(adjustedValue / 1000000).toFixed(1)}M`;
      if (adjustedValue >= 1000) return `$${(adjustedValue / 1000).toFixed(0)}K`;
      return `$${adjustedValue.toFixed(0)}`;
    }
    return Math.floor(adjustedValue).toString();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = 400;
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    initializeBubbles(canvas);
  }, [initializeBubbles]);

  useEffect(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    animate();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [animate]);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Time Range:</span>
          <div className="flex gap-1">
            {(['24h', '7d', '30d'] as TimeRange[]).map((range) => (
              <Button
                key={range}
                variant={timeRange === range ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTimeRange(range)}
                className="h-7 px-2 text-xs"
              >
                {range}
              </Button>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {isVolumeView ? 'Volume' : 'Count'}
          </span>
          <button
            onClick={() => onViewChange(!isVolumeView)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              isVolumeView ? 'bg-ocean-teal' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                isVolumeView ? 'translate-x-5' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full border border-gray-200 dark:border-gray-700 rounded-lg bg-white/50 dark:bg-transparent"
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
      </div>
    </div>
  );
};

export default SimpleBubbleChart;
