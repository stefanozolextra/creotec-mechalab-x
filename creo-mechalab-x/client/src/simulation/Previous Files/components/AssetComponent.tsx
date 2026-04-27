import React, { useState } from 'react';
import { Group, Rect, Circle, Image as KonvaImage } from 'react-konva';
import useImage from 'use-image';
import Pin from './Pin.tsx';
import { normalizePinName } from '../constants/pinConfiguration';
import { TOP_ROW_PINS, BOTTOM_ROW_PINS } from '../constants/customNodes';

interface AssetComponentProps {
  id: string;
  x: number;
  y: number;
  rotation: number;
  flipX: boolean;
  isWiring: boolean;
  isSelected: boolean;
  imageSrc: string;
  width: number;
  height: number;
  nodeSize: number;
  isLocked?: boolean;
  pinAId: string;
  pinBId: string;
  pinAOffset: { x: number; y: number };
  pinBOffset: { x: number; y: number };
  pinCId?: string;
  pinCOffset?: { x: number; y: number };
  pinOffsets?: Record<string, { x: number; y: number }>;
  isLit?: boolean;
  pinWireColorForPin?: (pinId: string) => string | undefined;
  pinTooltipForPin?: (pinId: string) => string | undefined;
  onComponentClick?: (id: string) => void;
  onPinMouseDown: (pinId: string) => void;
  onSelect: (id: string) => void;
  onDrag: (id: string, x: number, y: number) => void;
  onShowPinTooltip?: (text: string, pos: { x: number; y: number }) => void;
  onHidePinTooltip?: () => void;
}

const AssetComponent: React.FC<AssetComponentProps> = ({
  id, x, y, rotation, flipX, isWiring, isSelected, imageSrc, width, height, nodeSize, isLocked = false,
  pinAId, pinBId, pinAOffset, pinBOffset, pinCId, pinCOffset, pinOffsets, isLit = false,
  onComponentClick, onPinMouseDown, onSelect, onDrag, pinWireColorForPin, pinTooltipForPin,
  onShowPinTooltip, onHidePinTooltip,
}) => {
  const [assetImage] = useImage(imageSrc);
  void pinWireColorForPin;

  const [pinTooltips, setPinTooltips] = useState<Record<string, string>>({});

  const handleTooltipEdit = (pinId: string) => {
    const current = pinTooltips[pinId] ?? pinId;
    const newText = window.prompt('Edit pin tooltip', current);
    if (newText !== null) {
      setPinTooltips((s) => ({ ...s, [pinId]: newText }));
    }
  };

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
      onClick={(e) => {
        if (onComponentClick) {
          e.cancelBubble = true;
          onComponentClick(id);
        }
      }}
      onDragMove={(e) => onDrag(id, e.target.x() - width / 2, e.target.y() - height / 2)}
    >
      {assetImage ? (
        <KonvaImage image={assetImage} width={width} height={height} />
      ) : (
        <Rect width={width} height={height} fill="#bdc3c7" stroke="#2c3e50" strokeWidth={2} cornerRadius={4} />
      )}
      {isSelected && (
        <Rect width={width} height={height} stroke="#f39c12" strokeWidth={4} cornerRadius={4} listening={false} />
      )}
      {isLit && (
        <Circle
          x={width / 2}
          y={height / 2}
          radius={Math.max(12, Math.min(width, height) / 4)}
          fill="#ff3b30"
          opacity={0.35}
          shadowColor="#ff3b30"
          shadowBlur={24}
          listening={false}
        />
      )}
      {(() => {
        // Simplified: render every pin as white regardless of component type or wire state.
        if (pinOffsets) {
          return Object.entries(pinOffsets).map(([pinId, pinOffset]) => {
            const fullPinId = `${id}-${pinId}`;
            const wireFill = pinWireColorForPin ? pinWireColorForPin(fullPinId) : undefined;
            const pinName = normalizePinName(fullPinId);
            const isTallComponent = id.startsWith('magneticMotor') || id.startsWith('limitSwitch') || id.startsWith('solenoidValve');
            const extra = isTallComponent ? Math.max(12, nodeSize * 2) : 0;
            const topOffset = -Math.max(18, nodeSize * 4 + 6) - extra;
            const bottomOffset = Math.max(6, nodeSize * 4 - 6) + extra;
            const rightOffset = Math.max(12, nodeSize * 3);
            const tooltipOffset = TOP_ROW_PINS.includes(pinName)
              ? { x: rightOffset, y: topOffset }
              : BOTTOM_ROW_PINS.includes(pinName)
                ? { x: rightOffset, y: bottomOffset }
                : { x: rightOffset, y: -18 };
            return (
              <Pin
                key={fullPinId}
                id={fullPinId}
                ox={pinOffset.x}
                oy={pinOffset.y}
                nodeSize={nodeSize}
                onMouseDown={onPinMouseDown}
                fillColor={wireFill ?? '#ffffff'}
                tooltipText={pinTooltips[fullPinId] ?? pinTooltipForPin?.(fullPinId)}
                tooltipRotation={-rotation}
                tooltipFlip={flipX}
                onTooltipEdit={handleTooltipEdit}
                tooltipOffset={tooltipOffset}
                onShowPinTooltip={onShowPinTooltip}
                onHidePinTooltip={onHidePinTooltip}
              />
            );
          });
        }

        return (
          <>
            {
              (() => {
                const fullA = `${id}-${pinAId}`;
                const pinAName = normalizePinName(fullA);
                const isTallA = id.startsWith('magneticMotor') || id.startsWith('limitSwitch') || id.startsWith('solenoidValve');
                const extraA = isTallA ? Math.max(12, nodeSize * 2) : 0;
                const topOffsetA = -Math.max(18, nodeSize * 4 + 6) - extraA;
                const bottomOffsetA = Math.max(6, nodeSize * 4 - 6) + extraA;
                const tooltipOffsetA = TOP_ROW_PINS.includes(pinAName) ? { x: Math.max(12, nodeSize * 3), y: topOffsetA } : BOTTOM_ROW_PINS.includes(pinAName) ? { x: Math.max(12, nodeSize * 3), y: bottomOffsetA } : { x: Math.max(12, nodeSize * 3), y: -18 };

                const fullB = `${id}-${pinBId}`;
                const pinBName = normalizePinName(fullB);
                const isTallB = id.startsWith('magneticMotor') || id.startsWith('limitSwitch') || id.startsWith('solenoidValve');
                const extraB = isTallB ? Math.max(12, nodeSize * 2) : 0;
                const topOffsetB = -Math.max(18, nodeSize * 4 + 6) - extraB;
                const bottomOffsetB = Math.max(6, nodeSize * 4 - 6) + extraB;
                const tooltipOffsetB = TOP_ROW_PINS.includes(pinBName) ? { x: Math.max(12, nodeSize * 3), y: topOffsetB } : BOTTOM_ROW_PINS.includes(pinBName) ? { x: Math.max(12, nodeSize * 3), y: bottomOffsetB } : { x: Math.max(12, nodeSize * 3), y: -18 };

                return (
                  <>
                    <Pin id={fullA} ox={pinAOffset.x} oy={pinAOffset.y} nodeSize={nodeSize} onMouseDown={onPinMouseDown} fillColor={pinWireColorForPin ? pinWireColorForPin(fullA) ?? '#ffffff' : '#ffffff'} tooltipText={pinTooltips[fullA] ?? pinTooltipForPin?.(fullA)} tooltipRotation={-rotation} tooltipFlip={flipX} onTooltipEdit={handleTooltipEdit} tooltipOffset={tooltipOffsetA} onShowPinTooltip={onShowPinTooltip} onHidePinTooltip={onHidePinTooltip} />
                    <Pin id={fullB} ox={pinBOffset.x} oy={pinBOffset.y} nodeSize={nodeSize} onMouseDown={onPinMouseDown} fillColor={pinWireColorForPin ? pinWireColorForPin(fullB) ?? '#ffffff' : '#ffffff'} tooltipText={pinTooltips[fullB] ?? pinTooltipForPin?.(fullB)} tooltipRotation={-rotation} tooltipFlip={flipX} onTooltipEdit={handleTooltipEdit} tooltipOffset={tooltipOffsetB} onShowPinTooltip={onShowPinTooltip} onHidePinTooltip={onHidePinTooltip} />
                    {pinCId && pinCOffset && (() => {
                      const fullC = `${id}-${pinCId}`;
                      const pinCName = normalizePinName(fullC);
                      const isTallC = id.startsWith('magneticMotor') || id.startsWith('limitSwitch') || id.startsWith('solenoidValve');
                      const extraC = isTallC ? Math.max(12, nodeSize * 2) : 0;
                      const topOffsetC = -Math.max(18, nodeSize * 4 + 6) - extraC;
                      const bottomOffsetC = Math.max(6, nodeSize * 4 - 6) + extraC;
                      const tooltipOffsetC = TOP_ROW_PINS.includes(pinCName) ? { x: Math.max(12, nodeSize * 3), y: topOffsetC } : BOTTOM_ROW_PINS.includes(pinCName) ? { x: Math.max(12, nodeSize * 3), y: bottomOffsetC } : { x: Math.max(12, nodeSize * 3), y: -18 };
                      return <Pin id={fullC} ox={pinCOffset.x} oy={pinCOffset.y} nodeSize={nodeSize} onMouseDown={onPinMouseDown} fillColor={pinWireColorForPin ? pinWireColorForPin(fullC) ?? '#ffffff' : '#ffffff'} tooltipText={pinTooltips[fullC] ?? pinTooltipForPin?.(fullC)} tooltipRotation={-rotation} tooltipFlip={flipX} onTooltipEdit={handleTooltipEdit} tooltipOffset={tooltipOffsetC} onShowPinTooltip={onShowPinTooltip} onHidePinTooltip={onHidePinTooltip} />;
                    })()}
                  </>
                );
              })()
            }
          </>
        );
      })()}
    </Group>
  );
};

export default AssetComponent;
