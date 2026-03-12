import useImage from 'use-image';
import { Group, Image, Circle } from 'react-konva';
import type { Circle as KonvaCircle } from 'konva/lib/shapes/Circle';
import { COMPONENT_LIBRARY } from '../constants/componentConfig';

interface CustomComponentProps {
  type: string;
  instanceId: string;
  x: number;
  y: number;
  onPinMouseDown: (pinId: string) => void;
  onPinMouseUp: (pinId: string) => void;
  onDrag: (id: string, x: number, y: number) => void;
}

export const CustomComponent = ({
  type,
  instanceId,
  x,
  y,
  onPinMouseDown,
  onPinMouseUp,
  onDrag,
}: CustomComponentProps) => {
  const config = COMPONENT_LIBRARY[type];
  const [img] = useImage(config.imageUrl);

  return (
    <Group
      x={x}
      y={y}
      draggable
      onDragMove={(e) => onDrag(instanceId, e.target.x(), e.target.y())}
    >
      <Image image={img} width={config.width} height={config.height} />
      {config.pins.map((pin) => (
        <Circle
          key={`${instanceId}-${pin.id}`}
          x={pin.x}
          y={pin.y}
          radius={6}
          fill="white"
          stroke="#333"
          strokeWidth={1}
          hitStrokeWidth={15}
          onMouseDown={(e) => {
            e.cancelBubble = true;
            onPinMouseDown(`${instanceId}-${pin.id}`);
          }}
          onMouseUp={(e) => {
            e.cancelBubble = true;
            onPinMouseUp(`${instanceId}-${pin.id}`);
          }}
          onMouseEnter={(e) => {
            const node = e.target as KonvaCircle;
            node.stroke('#2ecc71');
            node.strokeWidth(2);
            const container = node.getStage()?.container();
            if (container) container.style.cursor = 'crosshair'; // Fixed property
          }}
          onMouseLeave={(e) => {
            const node = e.target as KonvaCircle;
            node.stroke('#333');
            node.strokeWidth(1);
            const container = node.getStage()?.container();
            if (container) container.style.cursor = 'default';
          }}
        />
      ))}
    </Group>
  );
};