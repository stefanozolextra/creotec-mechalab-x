export type ModuleStatusValue = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
export type ResourceType = "PDF" | "VIDEO";
export type PgNumeric = string | number;
export type TraineeAccessMode = "standard" | "lesson_only";

export interface TraineeProfileApi {
    trainee_id: PgNumeric;
    trainee_code: string;
    first_name: string;
    middle_name: string | null;
    last_name: string;
    email: string;
    contact_number: string | null;
    address: string | null;
    birth_date: string | null;
    batch_code: string;
    access_mode: TraineeAccessMode;
}

export interface ModuleStatusApi {
    module_id: PgNumeric;
    module_code: string;
    module_title: string;
    required_sims: PgNumeric;
    completed_required_sims: PgNumeric;
    module_status: ModuleStatusValue;
}

export interface ModuleApi {
    module_id: PgNumeric;
    module_code: string;
    title: string;
    description: string | null;
    order_no: number;
    is_active: boolean;
}

export interface ModuleResourceApi {
    resource_id: PgNumeric;
    module_id: PgNumeric;
    type: ResourceType;
    title: string;
    url: string;
    order_no: number;
    file_id?: PgNumeric | null;
    original_filename?: string | null;
    mime_type?: string | null;
    file_size?: PgNumeric | null;
    has_uploaded_file?: boolean;
    resolved_url?: string | null;
}

export interface SimulationApi {
    simulation_id: PgNumeric;
    module_id: PgNumeric;
    simulation_code: string;
    title: string;
    description: string | null;
    order_no: number;
    is_required: boolean;
}

export interface SimulationProgressApi {
    simulation_id: PgNumeric;
    is_completed: boolean;
    best_score: PgNumeric | null;
    completed_at: string | null;
    updated_at: string | null;
}

export interface DashboardResponseApi {
    trainee: TraineeProfileApi;
    moduleStatus: ModuleStatusApi[];
    moduleContent: {
        modules: ModuleApi[];
        resources: ModuleResourceApi[];
        simulations: SimulationApi[];
    };
    simulationProgress: SimulationProgressApi[];
}

export interface DashboardState {
    data: DashboardResponseApi | null;
    loading: boolean;
    error: string | null;
    completingSimulationIds: Record<string, boolean>;
    staleAfterMutation: boolean;
}
