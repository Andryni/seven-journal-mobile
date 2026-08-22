import React from 'react';
import Svg, { Path, Rect, Defs, LinearGradient, Stop } from 'react-native-svg';

interface SevenLogoProps {
  size?: number;
}

export const SevenLogo: React.FC<SevenLogoProps> = ({ size = 28 }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Defs>
        <LinearGradient id="sevenGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#6366F1" />
          <Stop offset="50%" stopColor="#4F46E5" />
          <Stop offset="100%" stopColor="#10B981" />
        </LinearGradient>
        <LinearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#34D399" />
          <Stop offset="100%" stopColor="#059669" />
        </LinearGradient>
        <LinearGradient id="bgGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <Stop offset="0%" stopColor="#1E1B4B" stopOpacity="0.8" />
          <Stop offset="100%" stopColor="#0F172A" stopOpacity="0.9" />
        </LinearGradient>
      </Defs>

      {/* Cadre biseauté sombre institutionnel */}
      <Rect
        x="1"
        y="1"
        width="38"
        height="38"
        rx="10"
        fill="url(#bgGrad)"
        stroke="rgba(99, 102, 241, 0.35)"
        strokeWidth="1.5"
      />

      {/* Barres quantitatives en fond (Histogramme / Chandelier) */}
      <Rect x="9" y="22" width="3.5" height="8" rx="1.5" fill="rgba(255, 255, 255, 0.15)" />
      <Rect x="15" y="16" width="3.5" height="14" rx="1.5" fill="rgba(99, 102, 241, 0.3)" />
      <Rect x="21" y="24" width="3.5" height="6" rx="1.5" fill="rgba(239, 68, 68, 0.3)" />
      <Rect x="27" y="10" width="3.5" height="20" rx="1.5" fill="url(#barGrad)" />

      {/* Le chiffre '7' stylisé & géométrique (Ligne supérieure + Diagonale franche) */}
      <Path
        d="M 10 11 L 30 11 L 18 31 L 22.5 31 L 33 14 L 33 8.5 L 10 8.5 Z"
        fill="url(#sevenGrad)"
      />

      {/* Point lumineux d'entrée de trade sur la crête du 7 */}
      <Rect x="28.5" y="8.5" width="4.5" height="4.5" rx="2.25" fill="#34D399" />
    </Svg>
  );
};
