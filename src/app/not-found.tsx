import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f6f7fb' }}>
      <div className="text-center">
        <p className="text-7xl font-black text-gray-200 mb-4">404</p>
        <p className="text-xl font-bold text-gray-700 mb-2">Page not found</p>
        <p className="text-sm text-gray-400 mb-6">This page doesn't exist or you don't have access.</p>
        <Link
          href="/board"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors"
        >
          ← Back to board
        </Link>
      </div>
    </div>
  )
}
