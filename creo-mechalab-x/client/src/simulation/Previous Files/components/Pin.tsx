import React from 'react';
import { Circle } from 'react-konva';
import type { Circle as KonvaCircle } from 'konva/lib/shapes/Circle';
import type { KonvaEventObject } from 'konva/lib/Node';

interface PinProps {
  id: string;
  ox: number;
  oy: number;
  nodeSize: number;
  onMouseDown: (id: string) => void;
  fillColor?: string;
  tooltipText?: string;
  tooltipOffset?: { x: number; y: number };
  onTooltipEdit?: (id: string) => void;
  tooltipRotation?: number;
  tooltipFlip?: boolean;
  onShowPinTooltip?: (text: string, pos: { x: number; y: number }) => void;
  onHidePinTooltip?: () => void;
}

const Pin: React.FC<PinProps> = ({
  id,
  ox,
  oy,
  nodeSize,
  onMouseDown,
  fillColor,
  tooltipText,
  tooltipOffset,
  onTooltipEdit,
  tooltipRotation,
  tooltipFlip,
  onShowPinTooltip,
  onHidePinTooltip,
}) => {
  // explicitly use otherwise-unused props to satisfy lint/type checks
  void tooltipRotation;
  void tooltipFlip;

  const offset = tooltipOffset ?? { x: 8, y: -18 };
  const hasTooltip = Boolean(tooltipText && tooltipText.trim().length > 0);
  const tooltipLabel = hasTooltip ? tooltipText as string : undefined;

  return (
    <Circle
      pinId={id}
      x={ox}
      y={oy}
      radius={nodeSize}
      fill={fillColor ?? 'white'}
      stroke="#333"
      strokeWidth={1}
      hitStrokeWidth={Math.max(14, nodeSize * 3)}
      onMouseDown={(e: KonvaEventObject<MouseEvent>) => {
        e.cancelBubble = true;
        onMouseDown(id);
      }}
      onMouseEnter={(e: KonvaEventObject<MouseEvent>) => {
        const circle = e.target as KonvaCircle;
        circle.stroke('#2ecc71');
        circle.strokeWidth(2);
        const container = circle.getStage()?.container();
        if (container) container.style.cursor = 'crosshair';

        const abs = (e.target as KonvaCircle).getAbsolutePosition();
        const stageX = abs.x + (offset.x ?? 8);
        const stageY = abs.y + (offset.y ?? -18);
        if (onShowPinTooltip && hasTooltip && tooltipLabel) onShowPinTooltip(tooltipLabel, { x: stageX, y: stageY });
      }}
      onMouseLeave={(e: KonvaEventObject<MouseEvent>) => {
        const circle = e.target as KonvaCircle;
        circle.stroke('#333');
        circle.strokeWidth(1);
        const container = circle.getStage()?.container();
        if (container) container.style.cursor = 'default';
        if (onHidePinTooltip) onHidePinTooltip();
      }}
      onDblClick={(e: KonvaEventObject<MouseEvent>) => {
        e.cancelBubble = true;
        if (onTooltipEdit) onTooltipEdit(id);
      }}
    />
  );
};

export default Pin;
