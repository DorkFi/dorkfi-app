import type { ReactNode } from "react";
import HealthWaterGauge from "./HealthWaterGauge";

interface UnderwaterSceneProps {
  healthFactor: number | null;
  marketContextLine?: string | null;
  dorkNftImage?: string;
  underwaterBg: string;
  onEdit?: () => void;
  achievementsSlot?: ReactNode;
}

const UnderwaterScene = ({
  healthFactor,
  marketContextLine,
  dorkNftImage,
  underwaterBg: _underwaterBg,
  onEdit,
  achievementsSlot,
}: UnderwaterSceneProps) => {
  return (
    <div className="relative space-y-4">
      <HealthWaterGauge
        healthFactor={healthFactor}
        marketContextLine={marketContextLine}
        avatarSrc={dorkNftImage}
        onEdit={onEdit}
      />
      {achievementsSlot}
    </div>
  );
};

export default UnderwaterScene;
