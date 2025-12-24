import React from 'react';
import './styles.css';

import type { Metadata } from 'next';
import AdminLayoutClient from './AdminLayout';

export const metadata: Metadata = {
   title: 'Admin • VideoRoom',
   description: '',
   icons: {
      icon:
         process.env.NODE_ENV === 'development'
            ? '/favicons/admin-local.png?v=1'
            : '/favicons/admin-remote.png',
   },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
   return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
