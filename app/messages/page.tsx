import { redirect } from 'next/navigation';

// Legacy direct-message page — superseded by /messenger
export default function MessagesPage() {
  redirect('/messenger');
}
