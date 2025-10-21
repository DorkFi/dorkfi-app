
import HealthWaterGauge from './HealthWaterGauge';

interface UnderwaterSceneProps {
  healthFactor: number | null;
  dorkNftImage: string;
  underwaterBg: string;
}

const UnderwaterScene = ({
  healthFactor,
  dorkNftImage,
  underwaterBg
}: UnderwaterSceneProps) => {
  return (
    <div className="relative">
      <HealthWaterGauge healthFactor={healthFactor} avatarSrc={dorkNftImage} />
    </div>
  );
};

export default UnderwaterScene;
