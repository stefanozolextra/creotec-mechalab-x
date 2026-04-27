import { HW_STYLES, SOL_PAIR_Y, solPairX } from './plcBoardLayout';

export interface PlcPortConfig {
    x: number;
    y: number;
    color: string;
    label: string;
    desc: string;
}

export const PLC_HARDWARE_JACKS: Record<string, PlcPortConfig> = {
    '24v_1': { x: 377, y: 530, color: HW_STYLES.jackRed, label: '24V', desc: '+24VDC Supply' },
    '24v_2': { x: 420, y: 530, color: HW_STYLES.jackRed, label: '24V', desc: '+24VDC Supply' },
    '24v_3': { x: 377, y: 570, color: HW_STYLES.jackRed, label: '24V', desc: '+24VDC Supply' },
    '24v_4': { x: 420, y: 570, color: HW_STYLES.jackRed, label: '24V', desc: '+24VDC Supply' },
    '0v_1': { x: 377, y: 620, color: HW_STYLES.jackBlack, label: '0V', desc: '0VDC Supply' },
    '0v_2': { x: 420, y: 620, color: HW_STYLES.jackBlack, label: '0V', desc: '0VDC Supply' },
    '0v_3': { x: 377, y: 660, color: HW_STYLES.jackBlack, label: '0V', desc: '0VDC Supply' },
    '0v_4': { x: 420, y: 660, color: HW_STYLES.jackBlack, label: '0V', desc: '0VDC Supply' },

    'plc_com_in': { x: 60, y: 370, color: HW_STYLES.jackRed, label: 'COM', desc: 'Input COM' },
    'plc_in_00': { x: 110, y: 350, color: HW_STYLES.jackYellow, label: '00', desc: 'Input 0.00' },
    'plc_in_01': { x: 170, y: 350, color: HW_STYLES.jackYellow, label: '01', desc: 'Input 0.01' },
    'plc_in_02': { x: 230, y: 350, color: HW_STYLES.jackYellow, label: '02', desc: 'Input 0.02' },
    'plc_in_03': { x: 290, y: 350, color: HW_STYLES.jackYellow, label: '03', desc: 'Input 0.03' },
    'plc_in_04': { x: 350, y: 350, color: HW_STYLES.jackYellow, label: '04', desc: 'Input 0.04' },
    'plc_in_05': { x: 410, y: 350, color: HW_STYLES.jackYellow, label: '05', desc: 'Input 0.05' },
    'plc_in_06': { x: 111, y: 420, color: HW_STYLES.jackYellow, label: '06', desc: 'Input 0.06' },
    'plc_in_07': { x: 170, y: 420, color: HW_STYLES.jackYellow, label: '07', desc: 'Input 0.07' },
    'plc_in_08': { x: 230, y: 420, color: HW_STYLES.jackYellow, label: '08', desc: 'Input 0.08' },
    'plc_in_09': { x: 290, y: 420, color: HW_STYLES.jackYellow, label: '09', desc: 'Input 0.09' },
    'plc_in_10': { x: 350, y: 420, color: HW_STYLES.jackYellow, label: '10', desc: 'Input 0.10' },
    'plc_in_11': { x: 410, y: 420, color: HW_STYLES.jackYellow, label: '11', desc: 'Input 0.11' },

    'plc_com_out_1': { x: 55, y: 570, color: HW_STYLES.jackBlack, label: 'COM1', desc: 'Output COM 1' },
    'plc_out_00': { x: 85, y: 570, color: HW_STYLES.jackBlue, label: '00', desc: 'Output 10.00' },
    'plc_com_out_2': { x: 130, y: 570, color: HW_STYLES.jackBlack, label: 'COM2', desc: 'Output COM 2' },
    'plc_out_01': { x: 160, y: 570, color: HW_STYLES.jackBlue, label: '01', desc: 'Output 10.01' },
    'plc_com_out_3': { x: 205, y: 570, color: HW_STYLES.jackBlack, label: 'COM3', desc: 'Output COM 3' },
    'plc_out_02': { x: 235, y: 570, color: HW_STYLES.jackBlue, label: '02', desc: 'Output 10.02' },
    'plc_out_03': { x: 295, y: 570, color: HW_STYLES.jackBlue, label: '03', desc: 'Output 10.03' },
    'plc_com_out_4': { x: 55, y: 655, color: HW_STYLES.jackBlack, label: 'COM4', desc: 'Output COM 4' },
    'plc_out_04': { x: 95, y: 655, color: HW_STYLES.jackBlue, label: '04', desc: 'Output 10.04' },
    'plc_out_05': { x: 160, y: 655, color: HW_STYLES.jackBlue, label: '05', desc: 'Output 10.05' },
    'plc_out_06': { x: 225, y: 655, color: HW_STYLES.jackBlue, label: '06', desc: 'Output 10.06' },
    'plc_out_07': { x: 290, y: 655, color: HW_STYLES.jackBlue, label: '07', desc: 'Output 10.07' },

    'start_nc_in': { x: 710, y: 625, color: HW_STYLES.jackBlue, label: 'Nc', desc: 'Start (NC) In' },
    'start_nc_out': { x: 750, y: 625, color: HW_STYLES.jackBlue, label: 'NC', desc: 'Start (NC) Out' },
    'start_no_in': { x: 710, y: 660, color: HW_STYLES.jackYellow, label: 'NO', desc: 'Start (NO) In' },
    'start_no_out': { x: 750, y: 660, color: HW_STYLES.jackYellow, label: 'NO', desc: 'Start (NO) Out' },
    'stop_nc_in': { x: 860, y: 625, color: HW_STYLES.jackBlue, label: 'NC', desc: 'Stop (NC) In' },
    'stop_nc_out': { x: 900, y: 625, color: HW_STYLES.jackBlue, label: 'NC', desc: 'Stop (NC) Out' },
    'stop_no_in': { x: 860, y: 660, color: HW_STYLES.jackYellow, label: 'NO', desc: 'Stop (NO) In' },
    'stop_no_out': { x: 900, y: 660, color: HW_STYLES.jackYellow, label: 'NO', desc: 'Stop (NO) Out' },
    'selector_nc_in': { x: 1010, y: 625, color: HW_STYLES.jackBlue, label: 'NC', desc: 'Selector (NC) In' },
    'selector_nc_out': { x: 1050, y: 625, color: HW_STYLES.jackBlue, label: 'NC', desc: 'Selector (NC) Out' },
    'selector_no_in': { x: 1010, y: 660, color: HW_STYLES.jackYellow, label: 'NO', desc: 'Selector (NO) In' },
    'selector_no_out': { x: 1050, y: 660, color: HW_STYLES.jackYellow, label: 'NO', desc: 'Selector (NO) Out' },
    'emo_nc_in': { x: 1160, y: 625, color: HW_STYLES.jackBlue, label: 'NC', desc: 'EMO (NC) In' },
    'emo_nc_out': { x: 1200, y: 625, color: HW_STYLES.jackBlue, label: 'NC', desc: 'EMO (NC) Out' },
    'emo_no_in': { x: 1160, y: 660, color: HW_STYLES.jackYellow, label: 'NO', desc: 'EMO (NO) In' },
    'emo_no_out': { x: 1200, y: 660, color: HW_STYLES.jackYellow, label: 'NO', desc: 'EMO (NO) Out' },

    'sol3/2_a_plus': { x: solPairX(0, true), y: SOL_PAIR_Y, color: HW_STYLES.jackRed, label: 'A+', desc: 'Valve A+' },
    'sol3/2_a_minus': { x: solPairX(0, false), y: SOL_PAIR_Y, color: HW_STYLES.jackBlack, label: 'A-', desc: 'Valve A-' },
    'sol4/2_a_plus': { x: solPairX(1, true), y: SOL_PAIR_Y, color: HW_STYLES.jackRed, label: 'A+', desc: 'Valve A+' },
    'sol4/2_a_minus': { x: solPairX(1, false), y: SOL_PAIR_Y, color: HW_STYLES.jackBlack, label: 'A-', desc: 'Valve A-' },
    'sol4/2_b_plus': { x: solPairX(2, true), y: SOL_PAIR_Y, color: HW_STYLES.jackRed, label: 'A+', desc: 'Valve A+' },
    'sol4/2_b_minus': { x: solPairX(2, false), y: SOL_PAIR_Y, color: HW_STYLES.jackBlack, label: 'A-', desc: 'Valve A-' },
    'sol4/3_a_plus': { x: solPairX(3, true), y: SOL_PAIR_Y, color: HW_STYLES.jackRed, label: 'A+', desc: 'Valve A+' },
    'sol4/3_a_minus': { x: solPairX(3, false), y: SOL_PAIR_Y, color: HW_STYLES.jackBlack, label: 'A-', desc: 'Valve A-' },
    'sol4/3_b_plus': { x: solPairX(4, true), y: SOL_PAIR_Y, color: HW_STYLES.jackRed, label: 'A+', desc: 'Valve A+' },
    'sol4/3_b_minus': { x: solPairX(4, false), y: SOL_PAIR_Y, color: HW_STYLES.jackBlack, label: 'A-', desc: 'Valve A-' },

    'buzzer_plus': { x: 495, y: 665, color: HW_STYLES.jackRed, label: '+', desc: 'Buzzer Positive (+)' },
    'buzzer_minus': { x: 560, y: 665, color: HW_STYLES.jackBlack, label: '-', desc: 'Buzzer Negative (-)' },

    'reed_ret_1.1': { x: 495, y: 360, color: HW_STYLES.jackYellow, label: 'RET', desc: 'Cyl Retracted' },
    'reed_ext_1.2': { x: 535, y: 360, color: HW_STYLES.jackBlue, label: 'EXT', desc: 'Cyl Extended' },
    'reed_ret_2.1': { x: 615, y: 360, color: HW_STYLES.jackYellow, label: 'RET', desc: 'Cyl Retracted' },
    'reed_ext_2.2': { x: 655, y: 360, color: HW_STYLES.jackBlue, label: 'EXT', desc: 'Cyl Extended' },
    'reed_ret_3.1': { x: 555, y: 430, color: HW_STYLES.jackYellow, label: 'RET', desc: 'Cyl Retracted' },
    'reed_ext_3.2': { x: 595, y: 430, color: HW_STYLES.jackBlue, label: 'EXT', desc: 'Cyl Extended' },
};

export const GOTT_TRAINER_PORTS = PLC_HARDWARE_JACKS;