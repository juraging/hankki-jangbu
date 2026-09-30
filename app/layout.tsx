import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata={title:'한끼장부 · 법인 영수증 기록',description:'영수증 한 장으로 정리하는 나의 법인 식사 기록',appleWebApp:{capable:true,title:'한끼장부',statusBarStyle:'default'},manifest:'/manifest.webmanifest',icons:{icon:'/favicon.svg',shortcut:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="ko"><body>{children}</body></html>}
