
import HealthWaterGauge from './HealthWaterGauge';

interface UnderwaterSceneProps {
  healthFactor: number | null;
  dorkNftImage?: string;
  underwaterBg: string;
  onEdit?: () => void;
}

const UnderwaterScene = ({
  healthFactor,
  dorkNftImage,
  underwaterBg,
  onEdit
}: UnderwaterSceneProps) => {
  return (
    <div className="relative">
      <HealthWaterGauge healthFactor={healthFactor} avatarSrc={dorkNftImage} onEdit={onEdit} />
    </div>
  );
};

export default UnderwaterScene;
