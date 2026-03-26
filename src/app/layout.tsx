import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { WalletProvider } from '@/lib/wallet/WalletContext'
import { Header } from '@/components/layout/Header'
import { ProfileGuard } from '@/components/layout/ProfileGuard'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'BitSign — BSV Document Signing',
  description: 'Cryptographically sign documents anchored on the BSV blockchain.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-gray-50">
        <WalletProvider>
          <ProfileGuard>
            <Header />
            <main className="flex-1">{children}</main>
          </ProfileGuard>
        </WalletProvider>
      </body>
    </html>
  )
}
