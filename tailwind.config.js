/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  safelist: [
    // Animation classes that might be added dynamically
    'animate-shake',
    'animate-fall',
    'animate-bounce',
    'animate-spin',
    'animate-pulse',
    // Transform classes
    'scale-75',
    'scale-95',
    'scale-100',
    'scale-110',
    'scale-125',
    // Opacity classes
    'opacity-0',
    'opacity-50',
    // Text color variations for game states
    'text-yellow-400',
    'text-transparent',
    'text-gray-600/30',
    'text-red-500',
    'text-white',
    'text-white/80',
    'text-white/60',
    'text-white/30',
    'text-red-300',
    // Background variations
    'bg-gradient-to-br',
    'from-green-400',
    'to-emerald-500',
    'from-red-400',
    'to-pink-500',
    'from-blue-400',
    'to-blue-500',
    'from-yellow-400',
    'to-amber-500',
    'bg-white/30',
    'bg-white/20',
    'bg-white/10',
    'bg-white/5',
    'bg-green-500',
    'bg-red-500/50',
    'bg-red-500/70',
    // Border classes
    'border-2',
    'border-white/50',
    'border-blue-300',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
} 