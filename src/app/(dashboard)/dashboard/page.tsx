import { redirect } from 'next/navigation'

// This page has been replaced by /board
export default function DashboardPage() {
  redirect('/board')
}
