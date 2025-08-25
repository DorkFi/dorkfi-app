import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				'poppins': ['Poppins', 'sans-serif'],
			},
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				'ocean-teal': 'hsl(var(--ocean-teal))',
				'deep-sea-navy': 'hsl(var(--deep-sea-navy))',
				'deep-navy': '#061838',
				'whale-gold': 'hsl(var(--whale-gold))',
				'bubble-white': 'hsl(var(--bubble-white))',
				'ink-blue': 'hsl(var(--ink-blue))',
				'highlight-aqua': 'hsl(var(--highlight-aqua))',
				'sky-blue': 'hsl(var(--sky-blue))',
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			boxShadow: {
				'whale': '0 20px 40px rgba(6, 24, 56, 0.1), 0 1px 0px rgba(255, 255, 255, 0.8) inset',
				'whale-hover': '0 25px 50px rgba(6, 24, 56, 0.2), 0 1px 0px rgba(255, 255, 255, 0.9) inset',
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'bubble-float': {
					'0%, 100%': { transform: 'translateY(0px) scale(1)' },
					'50%': { transform: 'translateY(-10px) scale(1.05)' }
				},
				'wave-motion': {
					'0%, 100%': { transform: 'translateX(0px)' },
					'50%': { transform: 'translateX(10px)' }
				},
				'fade-in': {
					'0%': {
						opacity: '0',
						transform: 'translateY(20px)',
					},
					'100%': {
						opacity: '1',
						transform: 'translateY(0)',
					}
				},
				'bubble-rise': {
					'0%': { 
						transform: 'translateY(100vh) scale(0)',
						opacity: '0'
					},
					'10%': { 
						opacity: '1',
						transform: 'translateY(90vh) scale(0.8)'
					},
					'90%': { 
						opacity: '1',
						transform: 'translateY(10vh) scale(1)'
					},
					'100%': { 
						transform: 'translateY(-10vh) scale(0.9)',
						opacity: '0'
					}
				},
				'float-slow': {
					'0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
					'33%': { transform: 'translateY(-8px) rotate(0.5deg)' },
					'66%': { transform: 'translateY(-3px) rotate(-0.5deg)' }
				},
				'float-medium': {
					'0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
					'33%': { transform: 'translateY(-12px) rotate(1deg)' },
					'66%': { transform: 'translateY(-5px) rotate(-1deg)' }
				},
				'float-delayed-1': {
					'0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
					'40%': { transform: 'translateY(-10px) rotate(1.5deg)' },
					'70%': { transform: 'translateY(-4px) rotate(-1deg)' }
				},
				'float-delayed-2': {
					'0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
					'30%': { transform: 'translateY(-14px) rotate(-1.5deg)' },
					'60%': { transform: 'translateY(-6px) rotate(1deg)' }
				},
				'float-delayed-3': {
					'0%, 100%': { transform: 'translateY(0px) rotate(0deg)' },
					'35%': { transform: 'translateY(-16px) rotate(2deg)' },
					'65%': { transform: 'translateY(-7px) rotate(-1.5deg)' }
				},
				'float-spin': {
					'0%': { transform: 'translateY(0px) rotate(0deg)' },
					'25%': { transform: 'translateY(-8px) rotate(90deg)' },
					'50%': { transform: 'translateY(-12px) rotate(180deg)' },
					'75%': { transform: 'translateY(-6px) rotate(270deg)' },
					'100%': { transform: 'translateY(0px) rotate(360deg)' }
				},
				'float-large': {
					'0%, 100%': { transform: 'translateY(0px) rotate(0deg) scale(1)' },
					'33%': { transform: 'translateY(-20px) rotate(0.5deg) scale(1.02)' },
					'66%': { transform: 'translateY(-8px) rotate(-0.5deg) scale(0.98)' }
				},
				'glare-shift': {
					'0%, 100%': { 
						opacity: '0.6',
						transform: 'scale(1) rotate(0deg)'
					},
					'50%': { 
						opacity: '0.9',
						transform: 'scale(1.1) rotate(5deg)'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'bubble-float': 'bubble-float 3s ease-in-out infinite',
				'wave-motion': 'wave-motion 4s ease-in-out infinite',
				'fade-in': 'fade-in 0.6s ease-out',
				'bubble-rise': 'bubble-rise 16s linear infinite',
				'float-slow': 'float-slow 6s ease-in-out infinite',
				'float-medium': 'float-medium 5s ease-in-out infinite',
				'float-delayed-1': 'float-delayed-1 7s ease-in-out infinite',
				'float-delayed-2': 'float-delayed-2 6.5s ease-in-out infinite',
				'float-delayed-3': 'float-delayed-3 5.5s ease-in-out infinite',
				'float-spin': 'float-spin 8s linear infinite',
				'float-large': 'float-large 8s ease-in-out infinite',
				'glare-shift': 'glare-shift 4s ease-in-out infinite'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
