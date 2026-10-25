import { EffectComposer, Bloom, Vignette, Noise, DepthOfField, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';

/**
 * Post-processing stack scaled by the quality setting:
 *  low    → none
 *  medium → bloom + vignette
 *  high   → bloom + depth of field + film grain + vignette
 */
export default function Effects({ quality, dof }) {
  if (quality === 'low') return null;
  const high = quality === 'high';
  const passes = [
    <Bloom key="bloom" mipmapBlur intensity={high ? 0.9 : 0.6} luminanceThreshold={0.85} luminanceSmoothing={0.2} />,
  ];
  if (high && dof) passes.push(<DepthOfField key="dof" {...dof} />);
  if (high) passes.push(<Noise key="noise" premultiply opacity={0.35} />);
  passes.push(<Vignette key="vignette" offset={0.25} darkness={0.75} />);
  passes.push(<ToneMapping key="tone" mode={ToneMappingMode.ACES_FILMIC} />);
  return (
    <EffectComposer multisampling={high ? 4 : 0} enableNormalPass={false}>
      {passes}
    </EffectComposer>
  );
}
