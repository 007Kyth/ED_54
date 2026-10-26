// Flashy Instagram theme: near-black background with hot-pink, sunset-orange,
// purple and gold accents (the classic IG gradient palette).
export const COLORS = {
  primary: '#DD2A7B',      // hot pink / magenta (main)
  primaryDeep: '#8134AF',  // electric purple
  primarySoft: '#FEDA77',  // golden yellow highlight / hover
  sketchLine: '#F58529',   // sunset orange outline
  background: '#0B0410',
  card: '#1A0B24',
  surface: '#2A1238',
  surfaceSoft: '#3D1A52',
  textPrimary: '#FFF3FA',
  textSecondary: '#E7A8D0',
  textOnPrimary: '#FFFFFF',
  border: '#8134AF',
  shadow: '#DD2A7B',
  warning: '#FEDA77',
  success: '#3DFFB0',
  danger: '#FF3B5C',
} as const;

// The signature Instagram gradient (use with experimental_backgroundImage / LinearGradient).
export const IG_GRADIENT = 'linear-gradient(45deg, #FEDA77, #F58529, #DD2A7B, #8134AF, #515BD4)';

// Neon glow used on hover (works on web and new-architecture native).
export const GLOW = '0 0 20px rgba(221,42,123,0.65)';
export const GLOW_SOFT = '0 0 10px rgba(245,133,41,0.5)';
