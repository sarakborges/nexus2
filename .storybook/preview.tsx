import { useEffect } from 'react'
import type { ReactNode } from 'react'
import type { Preview } from '@storybook/react-vite'

import '../src/Assets/main.css'

type StorybookTheme = 'light' | 'dark'

type ThemeWrapperProps = {
  children: ReactNode
  theme: StorybookTheme
}

function ThemeWrapper({ children, theme }: ThemeWrapperProps) {
  useEffect(() => {
    document.documentElement.dataset.theme = theme

    return () => {
      delete document.documentElement.dataset.theme
    }
  }, [theme])

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: '24px',
        backgroundColor: 'var(--color-background)',
        color: 'var(--text-color)'
      }}
    >
      {children}
    </div>
  )
}

const preview: Preview = {
  globalTypes: {
    theme: {
      description: 'Color appearance used to preview the component.',
      defaultValue: 'dark',
      toolbar: {
        title: 'Appearance',
        icon: 'circlehollow',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' }
        ]
      }
    }
  },
  initialGlobals: {
    theme: 'dark'
  },
  decorators: [
    (Story, context) => (
      <ThemeWrapper theme={context.globals.theme as StorybookTheme}>
        <Story />
      </ThemeWrapper>
    )
  ],
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    }
  }
}

export default preview
