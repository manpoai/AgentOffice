import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '../lib/auth';
import { Shell } from '../components/Shell';

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/login');
  return <Shell />;
}
