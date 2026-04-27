import type { ActivityAnswerDefinition } from '../types';
import { createM6ActivityAnswer } from '../../../config/plcDefaultPin';
import { getM6LadderProgramDiagram } from './diagrams';

export const activity1Answer: ActivityAnswerDefinition = createM6ActivityAnswer({
    routeId: '6.1',
    title: 'Start–Stop PLC Controlled Pneumatics',
    instruction: 'Wire the PLC start-stop pneumatic circuit by connecting Input COM to +24VDC, START NO to input 0.00 and 0VDC, STOP NO to input 0.01 and 0VDC, Output COM 1 and COM 2 to 0VDC, Output 10.00 to the 4/2 A+ solenoid negative side with +24VDC on its positive side, and Output 10.01 to the 4/2 A- solenoid negative side with +24VDC on its positive side.',
    diagram: getM6LadderProgramDiagram('6.1'),
    rule: {
        minWires: 11,
        customConnections: [
            [
                ['plc_com_in', '24v_1'],
                ['plc_com_in', '24v_2'],
                ['plc_com_in', '24v_3'],
                ['plc_com_in', '24v_4'],
            ],
            ['start_no_in', 'plc_in_00'],
            [
                ['start_no_out', '0v_1'],
                ['start_no_out', '0v_2'],
                ['start_no_out', '0v_3'],
                ['start_no_out', '0v_4'],
            ],
            ['stop_no_in', 'plc_in_01'],
            [
                ['stop_no_out', '0v_1'],
                ['stop_no_out', '0v_2'],
                ['stop_no_out', '0v_3'],
                ['stop_no_out', '0v_4'],
            ],
            [
                ['plc_com_out_1', '0v_1'],
                ['plc_com_out_1', '0v_2'],
                ['plc_com_out_1', '0v_3'],
                ['plc_com_out_1', '0v_4'],
            ],
            [
                ['plc_com_out_2', '0v_1'],
                ['plc_com_out_2', '0v_2'],
                ['plc_com_out_2', '0v_3'],
                ['plc_com_out_2', '0v_4'],
            ],
            ['plc_out_00', 'sol4/2_b_minus'],
            [
                ['24v_1', 'sol4/2_b_plus'],
                ['24v_2', 'sol4/2_b_plus'],
                ['24v_3', 'sol4/2_b_plus'],
                ['24v_4', 'sol4/2_b_plus'],
            ],
            ['plc_out_01', 'sol4/2_a_minus'],
            [
                ['24v_1', 'sol4/2_a_plus'],
                ['24v_2', 'sol4/2_a_plus'],
                ['24v_3', 'sol4/2_a_plus'],
                ['24v_4', 'sol4/2_a_plus'],
            ],
        ],
    },
});
