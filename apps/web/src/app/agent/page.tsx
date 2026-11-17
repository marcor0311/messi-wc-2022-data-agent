import type { Metadata } from 'next';
import FootballAgent from '@/components/football-agent';
import './agent.css';
export const metadata:Metadata={title:'Messi · Football Data Agent',description:'El Mundial 2022 de Lionel Messi, explorado con datos verificados y un agente conversacional.'};
export default function AgentPage(){return <FootballAgent/>}
