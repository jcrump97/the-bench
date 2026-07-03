import { useGameStore } from '../../store/useGameStore';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { ErrorScreen } from '../screens/ErrorScreen';
import { GameShell } from './GameShell';

// Single phase → screen routing point.
export function AppShell() {
  const currentPhase = useGameStore((state) => state.currentPhase);

  switch (currentPhase) {
    case 'WELCOME':
      return <WelcomeScreen />;
    case 'ERROR_STATE':
      return <ErrorScreen />;
    default:
      return <GameShell />;
  }
}
