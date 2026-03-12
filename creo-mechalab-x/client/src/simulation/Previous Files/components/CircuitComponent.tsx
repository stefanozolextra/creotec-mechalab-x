import React from 'react';
import { Group, Rect, Text } from 'react-konva';
import Pin from './Pin.tsx';

interface ComponentProps {
  id: string;
  x: number;
  y: number;
  rotation: number;
  flipX: boolean;
  color: string;
  label: string;
  nodeSize: number;
  isWiring: boolean;
  isLocked?: boolean;
  isSelected: boolean;
  onPinMouseDown: (pinId: string) => void;
  onSelect: (id: string) => void;
  onDrag: (id: string, x: number, y: number) => void;
  pinWireColorForPin?: (pinId: string) => string | undefined;
  onShowPinTooltip?: (text: string, pos: { x: number; y: number }) => void;
  onHidePinTooltip?: () => void;
}

const CircuitComponent: React.FC<ComponentProps> = ({ id, x, y, rotation, flipX, color, label, nodeSize, isWiring, isLocked = false, isSelected, onPinMouseDown, onSelect, onDrag, pinWireColorForPin, onShowPinTooltip, onHidePinTooltip }) => {
  const width = 80;
  const height = 120;

  return (
    <Group 
      x={x + width / 2}
      y={y + height / 2}
      offsetX={width / 2}
      offsetY={height / 2}
      rotation={rotation}
      scaleX={flipX ? -1 : 1}
      draggable={!isWiring && !isLocked}
      onMouseDown={(e) => {
        e.cancelBubble = true;
        onSelect(id);
      }}
      onDragMove={(e) => onDrag(id, e.target.x() - width / 2, e.target.y() - height / 2)}
    >
      <Rect width={width} height={height} fill={color} stroke={isSelected ? '#f39c12' : '#2c3e50'} strokeWidth={isSelected ? 4 : 2} cornerRadius={4} />
      <Text text={label} x={8} y={height / 2 - 5} fill="white" fontStyle="bold" />
      <Pin id={`${id}-in`} ox={width / 2} oy={0} nodeSize={nodeSize} onMouseDown={onPinMouseDown} fillColor={pinWireColorForPin ? pinWireColorForPin(`${id}-in`) : undefined} onShowPinTooltip={onShowPinTooltip} onHidePinTooltip={onHidePinTooltip} />
      <Pin id={`${id}-out`} ox={width / 2} oy={height} nodeSize={nodeSize} onMouseDown={onPinMouseDown} fillColor={pinWireColorForPin ? pinWireColorForPin(`${id}-out`) : undefined} onShowPinTooltip={onShowPinTooltip} onHidePinTooltip={onHidePinTooltip} />
    </Group>
  );
};

export default CircuitComponent;
