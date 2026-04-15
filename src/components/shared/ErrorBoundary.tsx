'use client'
// ============================================================
// ErrorBoundary — React class component that catches render
// errors in the subtree and shows a friendly fallback.
// ============================================================

import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children:  React.ReactNode
  fallback?: React.ReactNode
  context?:  string  // e.g. "Kanban board", "Lead panel"
}

interface State {
  hasError: boolean
  error:    Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.context ? ` · ${this.props.context}` : ''}]`, error, info)
  }

  reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback

      return (
        <div className="flex flex-col items-center justify-center py-16 px-8 gap-4 text-center">
          <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center">
            <AlertTriangle size={20} className="text-red-400" />
          </div>
          <div>
            <p className="font-semibold text-gray-800 dark:text-gray-100 text-md mb-1">
              {this.props.context ? `${this.props.context} failed to load` : 'Something went wrong'}
            </p>
            <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
              {this.state.error?.message ?? 'An unexpected error occurred. This has been noted.'}
            </p>
          </div>
          <button
            onClick={this.reset}
            className="btn btn-secondary btn-sm gap-1.5"
          >
            <RefreshCw size={12} /> Try again
          </button>
          {process.env.NODE_ENV === 'development' && (
            <details className="text-left mt-2 max-w-md">
              <summary className="text-xs text-gray-400 cursor-pointer">Stack trace</summary>
              <pre className="text-2xs text-red-400 mt-2 overflow-x-auto bg-red-50 dark:bg-red-900/10 p-3 rounded-lg">
                {this.state.error?.stack}
              </pre>
            </details>
          )}
        </div>
      )
    }
    return this.props.children
  }
}

// ── Wrapper for async errors (with reset key) ─────────────

export function AsyncBoundary({
  children, context,
}: { children: React.ReactNode; context?: string }) {
  return (
    <ErrorBoundary context={context}>
      {children}
    </ErrorBoundary>
  )
}
