import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'YOLOv8 Object Detection | AI-Powered Image Analysis',
  description: 'Upload images and detect objects instantly using state-of-the-art YOLOv8 AI models',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
