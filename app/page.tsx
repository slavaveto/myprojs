import { headers } from 'next/headers';
import MainClientWrapper from '@/app/MainPage';

export default async function Page() {
  const headersList = await headers();
  const subdomain = headersList.get('x-subdomain');

  // Если субдомена нет, значит это лендинг
  const isLanding = !subdomain;

  return (
    <MainClientWrapper 
        subdomain={subdomain} 
        isLanding={isLanding} 
    />
  );
}
