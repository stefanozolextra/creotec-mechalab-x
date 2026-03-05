import { useParams, useNavigate } from 'react-router-dom';
import CyberTransition from '../components/CyberTransition';
import SimulationApp from '../simulation/SimulationApp';

export default function SimulationView() {
    const { id } = useParams();
    const navigate = useNavigate();

    return (
        <CyberTransition>
            <SimulationApp
                routeId={id}
                onNavigateBack={() => navigate('/dashboard')}
            />
        </CyberTransition>
    );
}