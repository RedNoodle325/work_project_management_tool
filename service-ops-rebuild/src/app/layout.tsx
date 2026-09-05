import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Service Operations Command Center',description:'Global service operations management platform'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
