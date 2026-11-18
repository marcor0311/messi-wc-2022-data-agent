import type { Metadata } from 'next';
import localFont from 'next/font/local';
import AgentWorkspace from '@/components/agent-propuesta/workspace';
import './agent.css';
import './propuesta.css';

const manrope = localFont({ src: '../fonts/Manrope.woff2', variable: '--ap-font', weight: '200 800', display: 'swap' });

export const metadata: Metadata = {
  title: 'Conversación sobre Messi',
  description: 'Explora los datos del Mundial 2022 de Lionel Messi con un agente conversacional.',
};

export default function AgentPage() {
  return <div className={manrope.variable}><AgentWorkspace /></div>;
}
